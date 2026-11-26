use reqwest::{Client, Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{State, WebviewWindow};

const BASE: &str = "http://127.0.0.1:7832";
const UNAVAILABLE: &str = "无法连接本机 TuneWeave，请确认服务已在 127.0.0.1:7832 启动";
const INVALID: &str = "TuneWeave 返回了无法核实的数据";
const CHANGED: &str = "当前平台账号或登录操作已更改";
const UNCERTAIN: &str = "未能确认平台收藏结果，请刷新喜欢歌单核对";

#[derive(Copy, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Kugou,
    Kuwo,
}

impl Platform {
    // 仅允许固定的两种平台出现在接口路径及参数中。
    fn name(self) -> &'static str {
        match self {
            Self::Kugou => "kugou",
            Self::Kuwo => "kuwo",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Edition {
    Standard,
    Concept,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    uid: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    edition: Option<Edition>,
    can_add_favorites: bool,
}

#[derive(Clone)]
struct Session {
    account: Account,
    credential: String,
}

#[derive(Default)]
struct Login {
    generation: u64,
    pending: Option<String>,
    pending_edition: Option<Edition>,
    pending_supplement: bool,
    session: Option<Session>,
    supplement: Option<Session>,
}

#[derive(Default)]
struct Slot {
    login: Mutex<Login>,
    // 上游会轮换调用方凭据，同一平台的请求顺序执行。
    requests: tauri::async_runtime::Mutex<()>,
}

#[derive(Default)]
pub struct Accounts {
    kugou: Slot,
    kuwo: Slot,
}

impl Accounts {
    // 限制主窗口调用，选择对应平台独立的内存会话。
    fn slot(&self, window: &WebviewWindow, platform: Platform) -> Result<&Slot, String> {
        require_main_window(window)?;
        Ok(match platform {
            Platform::Kugou => &self.kugou,
            Platform::Kuwo => &self.kuwo,
        })
    }
}

// 只允许已经载入播放器的主窗口发起本地音乐服务请求。
fn require_main_window(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("请在主窗口管理平台账号".into());
    }
    Ok(())
}

impl Slot {
    // 只在读取或提交短暂的内存状态时持有同步锁。
    fn state(&self) -> Result<std::sync::MutexGuard<'_, Login>, String> {
        self.login.lock().map_err(|_| CHANGED.to_owned())
    }
}

// 用平台身份和不透明凭据格式检查每次交付的调用方凭据。
fn credential<'a>(value: &'a Value, platform: Platform) -> Option<&'a str> {
    (value["platform"] == platform.name() && value["format"] == "tuneweave_credential_v1")
        .then(|| value["value"].as_str())
        .flatten()
        .filter(|text| valid_secret(text))
}

// 允许文档中的不透明凭据进入固定请求头，拒绝控制字符和无效格式。
fn valid_secret(text: &str) -> bool {
    text.len() <= 87_389
        && text.strip_prefix("twc1_").is_some_and(|v| {
            !v.is_empty()
                && v.bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        })
}

// 校验平台的正整数字符串标识，避免将路径和其他曲目当作 ID。
fn numeric_id(id: &str) -> bool {
    id.len() <= 20
        && !id.is_empty()
        && !id.starts_with('0')
        && id.bytes().all(|c| c.is_ascii_digit())
}

// 只从明确已登录且平台匹配的资料读取当前账号 UID。
fn profile(data: &Value, platform: Platform, edition: Option<Edition>) -> Result<Account, String> {
    if data["platform"] != platform.name() || data["authenticated"] != true {
        return Err(INVALID.into());
    }
    let uid = data["user_id"]
        .as_str()
        .filter(|v| numeric_id(v))
        .ok_or(INVALID)?;
    Ok(Account {
        uid: uid.into(),
        edition,
        can_add_favorites: edition != Some(Edition::Concept),
        name: data["nickname"].as_str().unwrap_or(uid).to_owned(),
    })
}

struct Reply {
    status: StatusCode,
    body: Value,
    rotated: Option<String>,
}

impl Reply {
    // 只向窗口交付可公开的错误，不透传上游响应正文或凭据。
    fn data(&self) -> Result<&Value, String> {
        if self.status.is_success() && self.body["ok"] == true && !self.body["data"].is_null() {
            return Ok(&self.body["data"]);
        }
        if self
            .body
            .pointer("/error/details/write_outcome")
            .and_then(Value::as_str)
            == Some("unconfirmed")
        {
            return Err(UNCERTAIN.into());
        }
        Err(match self.status.as_u16() {
            400 => "平台拒绝了请求，请检查输入或重新开始验证",
            401 => "平台验证未通过，请重新登录",
            403 => "当前平台账号未授权这项操作",
            404 | 410 => "登录已到期或平台资源不存在",
            409 => "平台账号或歌单已变化，请刷新后核对",
            422 => "当前 TuneWeave 版本或平台账号不支持这项操作",
            429 => "平台请求过于频繁，请稍后再试",
            _ => "TuneWeave 未能取得平台确认，请稍后核对",
        }
        .into())
    }
}

// 仅请求回环服务的固定 API，关闭代理、重定向和自动重试，限制响应大小。
async fn request(
    platform: Platform,
    method: Method,
    path: &str,
    body: Option<Value>,
    token: Option<&str>,
) -> Result<Reply, String> {
    let client = Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(130))
        .build()
        .map_err(|_| UNAVAILABLE)?;
    let mut req = client.request(method, format!("{BASE}/v1/{path}"));
    if let Some(token) = token {
        req = req.header("X-TuneWeave-Credential", token);
    }
    if let Some(body) = body {
        req = req
            .header("Content-Type", "application/json")
            .body(body.to_string());
    }
    let mut response = req.send().await.map_err(|error| {
        if error.is_connect() {
            UNAVAILABLE
        } else {
            "等待本机 TuneWeave 响应失败"
        }
    })?;
    let status = response.status();
    let mut rotated = None;
    for header in response.headers().get_all("X-TuneWeave-Updated-Credential") {
        for item in header.to_str().map_err(|_| INVALID)?.split(',') {
            if let Some((p, secret)) = item.trim().split_once('=') {
                if p == platform.name() {
                    if !valid_secret(secret) {
                        return Err(INVALID.into());
                    }
                    rotated = Some(secret.to_owned());
                }
            }
        }
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| INVALID)? {
        if chunk.len() > (4 * 1024 * 1024) - bytes.len() {
            return Err(INVALID.into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let body: Value = serde_json::from_slice(&bytes).map_err(|_| INVALID)?;
    if rotated.is_none() {
        rotated = credential(&body["meta"]["caller_credential"], platform).map(str::to_owned);
    }
    Ok(Reply {
        status,
        body,
        rotated,
    })
}

// 启动所选酷狗版本的扫码或酷我短信，平台确认之前保留现有登录。
#[tauri::command]
pub async fn tuneweave_begin_login(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    platform: Platform,
    edition: Option<Edition>,
    for_concept_favorites: Option<bool>,
    phone: Option<String>,
    allow_account_creation: Option<bool>,
) -> Result<Value, String> {
    let slot = state.slot(&window, platform)?;
    let edition = match platform {
        Platform::Kugou => Some(edition.unwrap_or(Edition::Standard)),
        Platform::Kuwo if edition.is_none() => None,
        Platform::Kuwo => return Err("酷我登录不需要选择酷狗版本".into()),
    };
    let supplement = for_concept_favorites.unwrap_or(false);
    let (path, body) = match platform {
        Platform::Kugou => (
            "auth/qr",
            json!({"platform":"kugou","credential_mode":"client","login_type":edition}),
        ),
        Platform::Kuwo => {
            let phone = phone
                .as_deref()
                .filter(|s| {
                    s.len() == 11 && s.starts_with('1') && s.bytes().all(|c| c.is_ascii_digit())
                })
                .ok_or("请输入 11 位大陆手机号码")?;
            if allow_account_creation != Some(true) {
                return Err("请先确认未注册手机号完成验证时会创建酷我账号".into());
            }
            (
                "auth/challenges",
                json!({"platform":"kuwo","credential_mode":"client","method":"sms","backend":"standard","country_code":"86","principal":phone,"allow_account_creation":true}),
            )
        }
    };
    let generation = {
        let mut login = slot.state()?;
        if supplement
            && (edition != Some(Edition::Standard)
                || login.session.as_ref().and_then(|s| s.account.edition) != Some(Edition::Concept))
        {
            return Err("请先登录酷狗概念版，再使用同一账号扫码授权标准版".into());
        }
        login.generation += 1;
        login.pending = None;
        login.generation
    };
    let _order = slot.requests.lock().await;
    if slot.state()?.generation != generation {
        return Err(CHANGED.into());
    }
    let result = request(platform, Method::POST, path, Some(body), None).await?;
    let data = result.data()?;
    let tx = data["transaction_id"]
        .as_str()
        .filter(|s| {
            !s.is_empty()
                && s.len() <= 200
                && s.bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        })
        .ok_or(INVALID)?;
    let mut public = json!({"transactionId":tx, "expiresAt":data["expires_at"].as_str()});
    if matches!(platform, Platform::Kugou) {
        public["qrUrl"] = json!(
            data["url"]
                .as_str()
                .filter(|v| !v.is_empty() && v.len() < 4096)
                .ok_or(INVALID)?
        );
        if let Some(image) = data["image_data_url"]
            .as_str()
            .filter(|v| v.starts_with("data:image/png;base64,") && v.len() <= 150_000)
        {
            public["qrImage"] = json!(image);
        }
    }
    let mut login = slot.state()?;
    if login.generation != generation {
        return Err(CHANGED.into());
    }
    login.pending = Some(tx.into());
    login.pending_edition = edition;
    login.pending_supplement = supplement;
    Ok(public)
}

// 提交短信验证码或轮询二维码，独立验证 UID 后再切换当前账户。
#[tauri::command]
pub async fn tuneweave_finish_login(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    platform: Platform,
    transaction_id: String,
    code: Option<String>,
) -> Result<Value, String> {
    let slot = state.slot(&window, platform)?;
    let _order = slot.requests.lock().await;
    let (edition, supplement) = {
        let login = slot.state()?;
        if login.pending.as_deref() != Some(&transaction_id) {
            return Err(CHANGED.into());
        }
        (login.pending_edition, login.pending_supplement)
    };
    let (path, method, body) = match platform {
        Platform::Kugou => (format!("auth/qr/{transaction_id}"), Method::GET, None),
        Platform::Kuwo => {
            let code = code
                .as_deref()
                .filter(|s| s.len() == 5 && s.bytes().all(|c| c.is_ascii_digit()))
                .ok_or("请输入 5 位短信验证码")?;
            (
                format!("auth/challenges/{transaction_id}/verify"),
                Method::POST,
                Some(json!({"code":code})),
            )
        }
    };
    let reply = request(platform, method, &path, body, None).await?;
    let data = reply.data()?;
    let status = data["state"].as_str().ok_or(INVALID)?;
    if status != "confirmed" {
        let mut login = slot.state()?;
        if login.pending.as_deref() != Some(&transaction_id) {
            return Err(CHANGED.into());
        }
        match status {
            "waiting" | "scanned" => {}
            "expired" | "failed" => login.pending = None,
            _ => {
                login.pending = None;
                return Err("平台要求额外验证，请在官方客户端完成后重新登录".into());
            }
        }
        return Ok(json!({"status":status}));
    }
    let account = profile(&data["profile"], platform, edition)?;
    let token = credential(&data["caller_credential"], platform).ok_or(INVALID)?;
    let session = request(
        platform,
        Method::GET,
        &format!("auth/session?platform={}", platform.name()),
        None,
        Some(reply.rotated.as_deref().unwrap_or(token)),
    )
    .await?;
    let verified = profile(session.data()?, platform, edition)?;
    if verified.uid != account.uid {
        return Err("平台返回的登录账号不一致".into());
    }
    let token = session
        .rotated
        .as_deref()
        .or(reply.rotated.as_deref())
        .unwrap_or(token)
        .to_owned();
    let mut incoming = Session {
        account: verified.clone(),
        credential: token,
    };
    if supplement {
        {
            let login = slot.state()?;
            if login.pending.as_deref() != Some(&transaction_id) {
                return Err(CHANGED.into());
            }
            if !login.session.as_ref().is_some_and(|s| {
                s.account.uid == verified.uid && s.account.edition == Some(Edition::Concept)
            }) {
                return Err("扫码的标准版账号与当前概念版账号不同，请使用同一 UID 重新扫码".into());
            }
        }
        let path = format!("users/kugou:{}/favorites/playlist", verified.uid);
        let concept = account_request(
            slot,
            platform,
            &verified.uid,
            Some(Edition::Concept),
            false,
            Method::GET,
            &path,
        )
        .await?;
        let standard = request(
            platform,
            Method::GET,
            &path,
            None,
            Some(&incoming.credential),
        )
        .await?;
        if cloud_favorites_ref(&concept, &verified.uid)?
            != cloud_favorites_ref(&standard, &verified.uid)?
        {
            return Err("两个版本的「我喜欢」云歌单不同，无法绑定收藏授权".into());
        }
        if let Some(rotated) = standard.rotated {
            incoming.credential = rotated;
        }
    }
    let mut login = slot.state()?;
    if login.pending.as_deref() != Some(&transaction_id) {
        return Err(CHANGED.into());
    }
    login.pending = None;
    if supplement {
        let primary = login
            .session
            .as_mut()
            .filter(|s| {
                s.account.uid == verified.uid && s.account.edition == Some(Edition::Concept)
            })
            .ok_or(CHANGED)?;
        primary.account.can_add_favorites = true;
        let account = primary.account.clone();
        login.supplement = Some(incoming);
        Ok(json!({"status":"confirmed","account":account}))
    } else {
        login.supplement = None;
        login.session = Some(incoming);
        Ok(json!({"status":"confirmed","account":verified}))
    }
}

// 取消该窗口指定的登录事务，保留已登录账户。
#[tauri::command]
pub fn tuneweave_cancel_login(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    platform: Platform,
    transaction_id: String,
) -> Result<(), String> {
    let mut login = state.slot(&window, platform)?.state()?;
    if login.pending.as_deref() == Some(&transaction_id) {
        login.pending = None;
    }
    Ok(())
}

// 立即丢弃当前平台的内存凭据，并使正在进行的登录失效。
#[tauri::command]
pub fn tuneweave_logout(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    platform: Platform,
) -> Result<(), String> {
    let mut login = state.slot(&window, platform)?.state()?;
    login.generation += 1;
    login.pending = None;
    login.session = None;
    login.supplement = None;
    Ok(())
}

// 返回上次成功核验的公开资料；进程重启后需要重新登录。
#[tauri::command]
pub fn tuneweave_account(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    platform: Platform,
) -> Result<Option<Account>, String> {
    Ok(state
        .slot(&window, platform)?
        .state()?
        .session
        .as_ref()
        .map(|s| s.account.clone()))
}

// 在同一平台的串行队列内按 UID 发请求，轮换凭据和失效处理均限定原会话。
async fn account_request(
    slot: &Slot,
    platform: Platform,
    uid: &str,
    edition: Option<Edition>,
    supplement: bool,
    method: Method,
    path: &str,
) -> Result<Reply, String> {
    let session = {
        let login = slot.state()?;
        if supplement {
            &login.supplement
        } else {
            &login.session
        }
        .clone()
    }
    .filter(|s| s.account.uid == uid && s.account.edition == edition)
    .ok_or(if supplement {
        "请用同账号的酷狗标准版扫码授权收藏"
    } else {
        "当前账号或版本未授权，请核对登录账号"
    })?;
    let result = request(platform, method, path, None, Some(&session.credential)).await?;
    let mut login = slot.state()?;
    let selected = if supplement {
        &mut login.supplement
    } else {
        &mut login.session
    };
    let current = selected
        .as_mut()
        .filter(|s| {
            s.credential == session.credential
                && s.account.uid == uid
                && s.account.edition == edition
        })
        .ok_or(CHANGED)?;
    if result.status == StatusCode::UNAUTHORIZED {
        *selected = None;
        login.supplement = None;
        if let Some(primary) = &mut login.session {
            primary.account.can_add_favorites = false;
        }
    } else if let Some(token) = &result.rotated {
        current.credential = token.clone();
    }
    Ok(result)
}

// 分页读取本人系统喜欢歌单，仅交付歌曲资料和已核验的稳定引用。
#[tauri::command]
pub async fn tuneweave_favorites(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    platform: Platform,
    uid: String,
    edition: Option<Edition>,
    offset: u32,
    limit: u32,
) -> Result<Value, String> {
    let slot = state.slot(&window, platform)?;
    if !numeric_id(&uid) || !(1..=100).contains(&limit) {
        return Err("账号或分页参数无效".into());
    }
    let path = format!(
        "users/{}:{uid}/favorites/tracks?offset={offset}&limit={limit}",
        platform.name()
    );
    let _order = slot.requests.lock().await;
    let result = account_request(slot, platform, &uid, edition, false, Method::GET, &path).await?;
    let tracks = result
        .data()?
        .as_array()
        .filter(|v| v.len() <= limit as usize)
        .ok_or(INVALID)?;
    let mut items = Vec::with_capacity(tracks.len());
    for track in tracks {
        let id = track["id"]
            .as_str()
            .filter(|id| numeric_id(id))
            .ok_or(INVALID)?;
        if track["platform"] != platform.name()
            || track["ref"] != format!("{}:{id}", platform.name())
        {
            return Err(INVALID.into());
        }
        let artists = track["artists"]
            .as_array()
            .ok_or(INVALID)?
            .iter()
            .filter_map(|v| v["name"].as_str())
            .collect::<Vec<_>>()
            .join(" / ");
        let hash = track["extensions"]["hash"]
            .as_str()
            .filter(|v| v.len() == 32 && v.bytes().all(|c| c.is_ascii_hexdigit()));
        items.push(json!({
            "id": id,
            "name": track["name"].as_str().ok_or(INVALID)?,
            "artist": artists,
            "album": track["album"]["name"].as_str().unwrap_or_default(),
            "cover": track["album"]["cover_url"].as_str(),
            "durationMs": track["duration_ms"].as_u64(),
            "hash": hash,
            "albumAudioId": track["extensions"]["album_audio_id"].as_str().filter(|v| numeric_id(v)),
        }));
    }
    let page = &result.body["meta"]["pagination"];
    if page["offset"].as_u64() != Some(offset.into()) {
        return Err(INVALID.into());
    }
    let next = if page["has_more"].as_bool().ok_or(INVALID)? {
        Some(
            page["next_offset"]
                .as_u64()
                .filter(|n| *n > offset.into() && *n <= u32::MAX.into())
                .ok_or(INVALID)?,
        )
    } else {
        None
    };
    Ok(
        json!({"items":items,"nextOffset":next,"snapshotId":page["extensions"]["source_snapshot_id"].as_str()}),
    )
}

// 核验本人系统喜欢云歌单的完整引用，隔离跨账号、收藏歌单和普通列表。
fn cloud_favorites_ref<'a>(reply: &'a Reply, uid: &str) -> Result<&'a str, String> {
    let playlist = reply.data()?;
    let reference = playlist["ref"].as_str().ok_or(INVALID)?;
    let prefix = format!("kugou:cloudlist:{uid}:0:");
    if playlist["platform"] != "kugou" || !reference.strip_prefix(&prefix).is_some_and(numeric_id) {
        return Err("无法核对当前酷狗账号的系统喜欢歌单".into());
    }
    Ok(reference)
}

// 仅以匿名方式搜索酷狗公开曲目，编码关键词并限制查询规模。
pub(crate) async fn kugou_public_search(
    window: &WebviewWindow,
    query: &str,
    offset: u32,
) -> Result<Value, String> {
    require_main_window(window)?;
    let query = query.trim();
    if query.is_empty()
        || query.len() > 1024
        || query.chars().any(char::is_control)
        || offset > 1000
    {
        return Err("酷狗搜索参数无效".into());
    }
    let mut url = reqwest::Url::parse(BASE).map_err(|_| INVALID)?;
    url.query_pairs_mut()
        .append_pair("platform", "kugou")
        .append_pair("type", "track")
        .append_pair("q", query)
        .append_pair("limit", "30")
        .append_pair("offset", &offset.to_string());
    let path = format!("search?{}", url.query().ok_or(INVALID)?);
    let result = request(Platform::Kugou, Method::GET, &path, None, None).await?;
    result.data()?;
    Ok(result.body)
}

// 使用概念版凭据在同一云歌单回读目标歌曲，处理平台分页和内容变更。
async fn confirm_concept_track(
    slot: &Slot,
    uid: &str,
    playlist: &str,
    track: &str,
    liked: bool,
) -> Result<(), String> {
    let mut offset = 0;
    let mut snapshot = None;
    let started = Instant::now();
    loop {
        if started.elapsed() >= Duration::from_secs(120) {
            return Err(UNCERTAIN.into());
        }
        let path = format!("playlists/{playlist}/tracks?offset={offset}&limit=100");
        let response = account_request(
            slot,
            Platform::Kugou,
            uid,
            Some(Edition::Concept),
            false,
            Method::GET,
            &path,
        )
        .await?;
        let entries = response.data()?.as_array().ok_or(INVALID)?;
        let page = &response.body["meta"]["pagination"];
        let version = page["extensions"]["source_snapshot_id"]
            .as_str()
            .filter(|v| !v.is_empty())
            .ok_or(INVALID)?;
        if page["offset"].as_u64() != Some(offset)
            || snapshot.as_deref().is_some_and(|v| v != version)
        {
            return Err(UNCERTAIN.into());
        }
        for entry in entries {
            let id = entry["id"]
                .as_str()
                .filter(|v| numeric_id(v))
                .ok_or(INVALID)?;
            if entry["platform"] != "kugou" || entry["ref"] != format!("kugou:{id}") {
                return Err(INVALID.into());
            }
            if entry["ref"] == track {
                return if liked { Ok(()) } else { Err(UNCERTAIN.into()) };
            }
        }
        if !page["has_more"].as_bool().ok_or(INVALID)? {
            return if !liked && page["total"].as_u64() == Some(offset + entries.len() as u64) {
                Ok(())
            } else {
                Err(UNCERTAIN.into())
            };
        }
        if entries.len() != 100 {
            return Err(INVALID.into());
        }
        snapshot = Some(version.to_owned());
        offset = page["next_offset"]
            .as_u64()
            .filter(|n| *n == offset + 100 && *n < 38_400)
            .ok_or(UNCERTAIN)?;
    }
}

// 按平台曲目 ID 单次写入，只有上游回读确认目标状态后才返回成功。
#[tauri::command]
pub async fn tuneweave_set_favorite(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    platform: Platform,
    uid: String,
    edition: Option<Edition>,
    track_id: String,
    liked: bool,
) -> Result<bool, String> {
    let slot = state.slot(&window, platform)?;
    if !numeric_id(&uid) || !numeric_id(&track_id) {
        return Err("缺少平台曲目或账号 ID".into());
    }
    let reference = format!("{}:{track_id}", platform.name());
    let _order = slot.requests.lock().await;
    let concept = matches!(platform, Platform::Kugou) && edition == Some(Edition::Concept);
    let supplement = concept && slot.state()?.supplement.is_some();
    if concept && liked && !supplement {
        return Err("请先用同账号的酷狗标准版扫码授权，再为概念版添加喜欢".into());
    }
    let mut shared_target = None;
    if supplement {
        let path = format!("users/kugou:{uid}/favorites/playlist");
        let concept =
            account_request(slot, platform, &uid, edition, false, Method::GET, &path).await?;
        let standard = account_request(
            slot,
            platform,
            &uid,
            Some(Edition::Standard),
            true,
            Method::GET,
            &path,
        )
        .await?;
        let target = cloud_favorites_ref(&concept, &uid)?;
        if target != cloud_favorites_ref(&standard, &uid)? {
            let mut login = slot.state()?;
            login.supplement = None;
            if let Some(session) = &mut login.session {
                session.account.can_add_favorites = false;
            }
            return Err("两个版本的喜欢歌单已经变化，请重新核对标准版授权".into());
        }
        shared_target = Some(target.to_owned());
    }
    let path = format!("account/favorites/tracks/{reference}");
    let method = if liked { Method::PUT } else { Method::DELETE };
    let writer = if supplement {
        Some(Edition::Standard)
    } else {
        edition
    };
    let result = account_request(slot, platform, &uid, writer, supplement, method, &path).await?;
    if concept && !supplement && !liked && result.status == StatusCode::UNPROCESSABLE_ENTITY {
        return Err("概念版只能直接从默认名称的「我喜欢」歌单中移除单条歌曲。若歌曲重复或歌单已改名，请授权同账号标准版后重试".into());
    }
    let data = result.data()?;
    let target = data["extensions"]["favorite_playlist_ref"]
        .as_str()
        .unwrap_or_default();
    if data["resource_ref"] != reference
        || data["subscribed"].as_bool() != Some(liked)
        || !target.starts_with(&format!("{}:", platform.name()))
        || shared_target
            .as_ref()
            .is_some_and(|expected| expected != target)
        || matches!(platform, Platform::Kuwo) && data["extensions"]["confirmed"] != true
    {
        return Err(UNCERTAIN.into());
    }
    if supplement {
        confirm_concept_track(slot, &uid, target, &reference, liked)
            .await
            .map_err(|_| UNCERTAIN.to_owned())?;
    }
    Ok(liked)
}

// 仅在歌曲资料缺失时从酷狗公开详情核对同一规范歌曲引用的文件哈希。
#[tauri::command]
pub async fn tuneweave_kugou_track_hash(
    window: WebviewWindow,
    state: State<'_, Accounts>,
    track_id: String,
) -> Result<Option<String>, String> {
    state.slot(&window, Platform::Kugou)?;
    if !numeric_id(&track_id) {
        return Err("酷狗曲目 ID 无效".into());
    }
    let reference = format!("kugou:{track_id}");
    let result = request(
        Platform::Kugou,
        Method::GET,
        &format!("tracks/{reference}"),
        None,
        None,
    )
    .await?;
    let track = result.data()?;
    if track["platform"] != "kugou"
        || track["ref"] != reference
        || track["id"] != track_id
        || track["extensions"]["album_audio_id"] != track_id
    {
        return Ok(None);
    }
    Ok(track["extensions"]["hash"]
        .as_str()
        .filter(|s| s.len() == 32 && s.bytes().all(|c| c.is_ascii_hexdigit()))
        .map(str::to_owned))
}
