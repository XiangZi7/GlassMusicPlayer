use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const CACHE_FOLDER: &str = ".mirai-music-audio-cache-v1";
const DOWNLOAD_FOLDER: &str = ".mirai-music-downloads-v1";
const OWNER_FILE: &str = ".owner";
const MAX_AUDIO_BYTES: u64 = 512 * 1024 * 1024;
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
pub(crate) struct StorageState {
    mutation: Mutex<()>,
    downloading: AtomicBool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct StorageConfig {
    cache_directory: String,
    download_directory: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct StorageConfigUpdate {
    cache_directory: Option<String>,
    download_directory: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageInfo {
    supported: bool,
    cache_directory: String,
    audio_cache_directory: String,
    download_directory: String,
    cache_bytes: u64,
    cache_files: u64,
    download_bytes: u64,
    download_count: usize,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DownloadedTrack {
    key: String,
    platform: String,
    id: String,
    title: String,
    artist: String,
    album: String,
    file_name: String,
    path: String,
    bytes: u64,
    downloaded_at: u64,
    status: String,
    quality: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DownloadInput {
    api_base_url: String,
    platform: String,
    id: String,
    title: String,
    artist: String,
    album: String,
    quality: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheClearResult {
    removed_files: u64,
    removed_bytes: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaybackResponse {
    status: String,
    url: Option<String>,
}

// 仅在请求存活期间标记下载，成功或异常都会释放；不实现虚假的暂停恢复。
struct DownloadGuard(AppHandle);
impl Drop for DownloadGuard {
    fn drop(&mut self) {
        self.0
            .state::<StorageState>()
            .downloading
            .store(false, Ordering::Release);
    }
}

// 为当前操作创建唯一标识，不复用用户已有文件名。
fn nonce() -> String {
    format!(
        "{}-{}-{}",
        std::process::id(),
        timestamp(),
        SEQUENCE.fetch_add(1, Ordering::Relaxed)
    )
}

// 保存完成时间采用毫秒 UTC，前端按本地语言格式化。
fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// 显示普通 Windows 路径，不把内部的长路径命名空间暴露为默认文案。
fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    value.strip_prefix(r"\\?\").unwrap_or(&value).to_owned()
}

// Windows 目录联接与重解析点和普通符号链接都不进入文件操作。
fn is_link(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    false
}

// 拒绝相对路径、父级跳转、NTFS ADS 与重解析点；只创建用户明确选择的目录。
fn directory(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("目录必须是绝对路径。".into());
    }
    for component in path.components() {
        match component {
            Component::ParentDir | Component::CurDir => return Err("目录不能包含父级跳转。".into()),
            Component::Normal(name) if name.to_string_lossy().contains(':') => {
                return Err("目录名称不能包含替代数据流。".into());
            }
            _ => {}
        }
    }
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) if is_link(&metadata) || !metadata.is_dir() => {
                return Err("目录或其父级不能是链接、重解析点或文件。".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("无法检查目录权限。".into()),
        }
    }
    fs::create_dir_all(path).map_err(|_| "无法创建目录，请选择有写入权限的位置。")?;
    fs::canonicalize(path).map_err(|_| "无法确认目录的真实路径。".into())
}

// 只接管本应用命名并带所有权标记的子目录，不接管任何现有非空目录。
fn owned_directory(base: &Path, name: &str) -> Result<PathBuf, String> {
    let path = directory(&base.join(name))?;
    let marker = path.join(OWNER_FILE);
    let expected = format!("Mirai Music/{name}/v1");
    if marker.exists() {
        let metadata = fs::symlink_metadata(&marker).map_err(|_| "无法检查目录标记。")?;
        if is_link(&metadata) || !metadata.is_file() || metadata.len() > 200 {
            return Err("目录标记无效，已拒绝操作。".into());
        }
        let value = fs::read_to_string(&marker).map_err(|_| "无法读取目录标记。")?;
        if value != expected {
            return Err("该目录不属于本应用，已拒绝操作。".into());
        }
    } else {
        if fs::read_dir(&path)
            .map_err(|_| "无法读取目录。")?
            .next()
            .is_some()
        {
            return Err("自有子目录已存在且含未知数据，不能接管。".into());
        }
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&marker)
            .map_err(|_| "无法写入目录标记。")?;
        file.write_all(expected.as_bytes())
            .and_then(|_| file.sync_all())
            .map_err(|_| "无法保存目录标记。")?;
    }
    Ok(path)
}

// 配置固定保存于应用配置目录，和歌单、账户及下载记录使用不同文件。
fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|_| "无法取得应用配置目录。")?;
    Ok(directory(&base)?.join("storage-v1.json"))
}

// 原子替换本应用的目录配置，不触碰其他偏好文件。
fn save_config(app: &AppHandle, config: &StorageConfig) -> Result<(), String> {
    let path = config_path(app)?;
    if path.exists() {
        let metadata = fs::symlink_metadata(&path).map_err(|_| "无法检查存储配置。")?;
        if is_link(&metadata) || !metadata.is_file() {
            return Err("存储配置不是普通文件。".into());
        }
    }
    let temporary = path.with_file_name(format!(".storage-{}.part", nonce()));
    let data = serde_json::to_vec(config).map_err(|_| "无法编码目录配置。")?;
    let mut created = false;
    let result = (|| {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|_| "无法写入目录配置。")?;
        created = true;
        file.write_all(&data)
            .and_then(|_| file.sync_all())
            .map_err(|_| "无法保存目录配置。")?;
        fs::rename(&temporary, &path).map_err(|_| "无法提交目录配置。".to_string())
    })();
    if result.is_err() && created {
        let _ = fs::remove_file(&temporary);
    }
    result
}

// 默认 app cache 与 Downloads/Mirai Music；损坏配置明确失败，不静默重置用户路径。
fn load_config_unlocked(app: &AppHandle) -> Result<StorageConfig, String> {
    let path = config_path(app)?;
    if path.exists() {
        let metadata = fs::symlink_metadata(&path).map_err(|_| "无法检查存储配置。")?;
        if is_link(&metadata) || !metadata.is_file() || metadata.len() > 32768 {
            return Err("存储配置无效。".into());
        }
        let data = fs::read(&path).map_err(|_| "无法读取存储配置。")?;
        return serde_json::from_slice(&data)
            .map_err(|_| "存储配置损坏，请检查 storage-v1.json。".into());
    }
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|_| "无法取得应用缓存目录。")?;
    let downloads = app
        .path()
        .download_dir()
        .map_err(|_| "系统没有可用的下载目录，请选择目录。")?
        .join("Mirai Music");
    let config = normalize_config(StorageConfig {
        cache_directory: display_path(&cache),
        download_directory: display_path(&downloads),
    })?;
    save_config(app, &config)?;
    Ok(config)
}

// 校验配置与有效目录，下载不能放进会被清理的音频缓存子目录。
fn normalize_config(config: StorageConfig) -> Result<StorageConfig, String> {
    let cache = directory(Path::new(&config.cache_directory))?;
    let downloads = directory(Path::new(&config.download_directory))?;
    let audio = owned_directory(&cache, CACHE_FOLDER)?;
    if downloads.starts_with(&audio) {
        return Err("下载目录不能放在可清理的音频缓存中。".into());
    }
    owned_directory(&downloads, DOWNLOAD_FOLDER)?;
    Ok(StorageConfig {
        cache_directory: display_path(&cache),
        download_directory: display_path(&downloads),
    })
}

// 所有配置读取使用短锁；网络下载不占用统计和读取的锁。
fn config_for(app: &AppHandle) -> Result<StorageConfig, String> {
    let state = app.state::<StorageState>();
    let _guard = state.mutation.lock().map_err(|_| "存储状态异常。")?;
    normalize_config(load_config_unlocked(app)?)
}

// 缓存文件只允许固定命名的音频条目，不递归处理子目录和未知文件。
fn cache_file_name(name: &str) -> bool {
    name.strip_prefix("audio-")
        .and_then(|value| value.strip_suffix(".cache"))
        .is_some_and(|hash| hash.len() == 64 && hash.bytes().all(|byte| byte.is_ascii_hexdigit()))
}

// 统计或清理固定自有音频目录中的普通缓存条目；链接、账户和下载都不进入候选。
fn cache_candidates(root: &Path) -> Result<Vec<(PathBuf, u64)>, String> {
    let mut result = Vec::new();
    for entry in fs::read_dir(root).map_err(|_| "无法读取缓存目录。")? {
        let entry = entry.map_err(|_| "无法读取缓存条目。")?;
        if !cache_file_name(&entry.file_name().to_string_lossy()) {
            continue;
        }
        let metadata = fs::symlink_metadata(entry.path()).map_err(|_| "无法检查缓存条目。")?;
        if !is_link(&metadata) && metadata.is_file() {
            result.push((entry.path(), metadata.len()));
        }
    }
    Ok(result)
}

// 文件名始终由平台标识和清理后的歌曲信息生成，不接受任意相对路径。
fn clean_name(value: &str, limit: usize) -> String {
    let value: String = value
        .chars()
        .map(|c| {
            if c.is_control() || "<>:\"/\\|?*".contains(c) {
                '_'
            } else {
                c
            }
        })
        .take(limit)
        .collect();
    let value = value.trim_matches([' ', '.']).to_owned();
    if value.is_empty() {
        "Untitled".into()
    } else {
        value
    }
}

// 曲目标识限制为上游实际使用的数字或哈希，防止路径注入。
fn valid_identity(platform: &str, id: &str) -> bool {
    matches!(platform, "netease" | "kugou" | "kuwo")
        && !id.is_empty()
        && id.len() <= 40
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

// 记录只接受本目录普通音频文件，缺失、链接和大小不匹配都不会显示为已下载。
fn downloads_for(config: &StorageConfig) -> Result<Vec<DownloadedTrack>, String> {
    let root = directory(Path::new(&config.download_directory))?;
    let records = owned_directory(&root, DOWNLOAD_FOLDER)?;
    let mut downloads = Vec::new();
    for entry in fs::read_dir(records).map_err(|_| "无法读取下载记录。")? {
        let entry = entry.map_err(|_| "无法读取下载记录。")?;
        let path = entry.path();
        if path.extension().and_then(|v| v.to_str()) != Some("json") {
            continue;
        }
        let metadata = fs::symlink_metadata(&path).map_err(|_| "无法检查下载记录。")?;
        if is_link(&metadata) || !metadata.is_file() || metadata.len() > 32768 {
            continue;
        }
        let Ok(data) = fs::read(&path) else {
            continue;
        };
        let Ok(mut record) = serde_json::from_slice::<DownloadedTrack>(&data) else {
            continue;
        };
        if !valid_identity(&record.platform, &record.id)
            || !matches!(record.status.as_str(), "full" | "preview" | "unknown")
        {
            continue;
        }
        let file_name = Path::new(&record.file_name);
        if file_name.components().count() != 1
            || !matches!(file_name.components().next(), Some(Component::Normal(_)))
            || record
                .file_name
                .chars()
                .any(|c| matches!(c, '/' | '\\' | ':'))
        {
            continue;
        }
        let file = root.join(file_name);
        let Ok(metadata) = fs::symlink_metadata(&file) else {
            continue;
        };
        if is_link(&metadata)
            || !metadata.is_file()
            || metadata.len() != record.bytes
            || record.bytes < 1024
        {
            continue;
        }
        let mut prefix = [0u8; 64];
        let Ok(mut audio) = File::open(&file) else {
            continue;
        };
        let Ok(size) = audio.read(&mut prefix) else {
            continue;
        };
        if audio_extension(&prefix[..size]).is_none() {
            continue;
        }
        record.path = display_path(&file);
        downloads.push(record);
    }
    downloads.sort_by_key(|record| std::cmp::Reverse(record.downloaded_at));
    Ok(downloads)
}

// 统计仅来自已验证文件，绝不把本机歌单/账户或任意选择目录都算成缓存。
fn info_for(config: &StorageConfig) -> Result<StorageInfo, String> {
    let cache = directory(Path::new(&config.cache_directory))?;
    let audio = owned_directory(&cache, CACHE_FOLDER)?;
    let candidates = cache_candidates(&audio)?;
    let downloads = downloads_for(config)?;
    Ok(StorageInfo {
        supported: true,
        cache_directory: config.cache_directory.clone(),
        audio_cache_directory: display_path(&audio),
        download_directory: config.download_directory.clone(),
        cache_bytes: candidates.iter().map(|(_, n)| n).sum(),
        cache_files: candidates.len() as u64,
        download_bytes: downloads.iter().map(|item| item.bytes).sum(),
        download_count: downloads.len(),
    })
}

// 接收配置中的 HTTP(S) 后端，不带凭据、不跟随跳转，不接收音频直链。
fn backend_url(base: &str, input: &DownloadInput, endpoint: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(base).map_err(|_| "后端地址无效。")?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.path().trim_end_matches('/').ends_with("/api/v1")
    {
        return Err("下载只能使用不含凭据的配置后端 /api/v1 地址。".into());
    }
    url.path_segments_mut()
        .map_err(|_| "后端地址无效。")?
        .pop_if_empty()
        .extend([&input.platform, "tracks", &input.id, endpoint]);
    if let Some(quality) = &input.quality {
        url.query_pairs_mut().append_pair("quality", quality);
    }
    Ok(url)
}

// 支持的请求音质只表达愿望，不代表会员权限或实际音质。
fn valid_quality(value: Option<&str>) -> bool {
    value.is_none_or(|quality| {
        matches!(
            quality,
            "standard"
                | "exhigh"
                | "lossless"
                | "hires"
                | "jyeffect"
                | "sky"
                | "jymaster"
                | "vivid"
                | "dolby"
        )
    })
}

// 按响应的文件头确定扩展名，拒绝 HTML/JSON 错误页伪装音频。
fn audio_extension(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"fLaC") {
        Some("flac")
    } else if bytes.starts_with(b"OggS") {
        Some("ogg")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WAVE") {
        Some("wav")
    } else if bytes.get(4..8) == Some(b"ftyp") {
        Some("m4a")
    } else if bytes.starts_with(b"ID3") {
        Some("mp3")
    } else if bytes.len() >= 2 && bytes[0] == 0xff && bytes[1] & 0xf6 == 0xf0 {
        Some("aac")
    } else if bytes.len() >= 2
        && bytes[0] == 0xff
        && bytes[1] & 0xe0 == 0xe0
        && bytes[1] & 0x06 != 0
    {
        Some("mp3")
    } else {
        None
    }
}

// 发布下载时绝不替换已有目标；Windows 使用不含 REPLACE_EXISTING 的原子移动。
fn publish_part(from: &Path, to: &Path) -> Result<(), String> {
    if to.exists() {
        return Err("目标文件已存在，已保留原文件。".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{MOVEFILE_WRITE_THROUGH, MoveFileExW};
        let from: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
        if unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), MOVEFILE_WRITE_THROUGH) } == 0 {
            return Err("无法原子保存下载，现有文件不会被覆盖。".into());
        }
    }
    #[cfg(not(windows))]
    {
        fs::hard_link(from, to).map_err(|_| "无法原子保存下载，现有文件不会被覆盖。")?;
        fs::remove_file(from).map_err(|_| "音频已保存，但临时链接清理失败。")?;
    }
    Ok(())
}

// 下载只走配置后端，验证权限、响应、长度和文件头后才发布音频及元数据。
fn download_track(app: &AppHandle, input: DownloadInput) -> Result<DownloadedTrack, String> {
    if [&input.title, &input.artist, &input.album]
        .iter()
        .any(|value| value.chars().any(char::is_control))
        || !valid_identity(&input.platform, &input.id)
        || !valid_quality(input.quality.as_deref())
        || input.title.len() > 4096
        || input.artist.len() > 4096
        || input.album.len() > 4096
    {
        return Err("歌曲标识、音质或元数据无效。".into());
    }
    let state = app.state::<StorageState>();
    let config = {
        let _lock = state.mutation.lock().map_err(|_| "存储状态异常。")?;
        if state.downloading.swap(true, Ordering::AcqRel) {
            return Err("已有歌曲正在下载，请等待完成。".into());
        }
        match load_config_unlocked(app).and_then(normalize_config) {
            Ok(config) => config,
            Err(error) => {
                state.downloading.store(false, Ordering::Release);
                return Err(error);
            }
        }
    };
    let _download = DownloadGuard(app.clone());
    let client = reqwest::blocking::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|_| "无法建立下载连接。")?;
    let permission = client
        .get(backend_url(&input.api_base_url, &input, "playback")?)
        .header("Accept", "application/json")
        .send()
        .map_err(|_| "无法读取平台当前播放权限。")?;
    if !permission.status().is_success() {
        return Err(format!(
            "平台拒绝下载权限检查（HTTP {}）。",
            permission.status().as_u16()
        ));
    }
    let mut permission_bytes = Vec::new();
    permission
        .take(256 * 1024 + 1)
        .read_to_end(&mut permission_bytes)
        .map_err(|_| "无法读取播放权限响应。")?;
    if permission_bytes.len() > 256 * 1024 {
        return Err("播放权限响应过大。".into());
    }
    let playback: PlaybackResponse =
        serde_json::from_slice(&permission_bytes).map_err(|_| "平台没有返回有效播放权限。")?;
    if !matches!(playback.status.as_str(), "full" | "preview" | "unknown")
        || playback.url.as_deref().is_none_or(str::is_empty)
    {
        return Err("平台当前不提供可下载的音频，不会绕过会员或版权限制。".into());
    }
    let mut response = client
        .get(backend_url(&input.api_base_url, &input, "audio")?)
        .header("Accept-Encoding", "identity")
        .send()
        .map_err(|_| "下载音频请求失败或超时。")?;
    if response.status() != reqwest::StatusCode::OK
        || response.headers().contains_key("content-range")
    {
        return Err("音频响应不是完整文件，未保存下载。".into());
    }
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if !(content_type.starts_with("audio/") || content_type == "application/octet-stream") {
        return Err("平台响应不是音频文件。".into());
    }
    if response
        .headers()
        .get("content-encoding")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value != "identity")
    {
        return Err("音频响应使用了不支持的内容编码。".into());
    }
    let expected = response.content_length();
    if expected.is_some_and(|size| !(1024..=MAX_AUDIO_BYTES).contains(&size)) {
        return Err("音频文件为空、过小或超过 512MB 限制。".into());
    }
    // 旧后端的 /audio 未回传权限状态；未知不能冒充已验证的整曲，已知试听仍标为试听。
    let status = if playback.status == "preview" {
        "preview".to_string()
    } else {
        response
            .headers()
            .get("x-mirai-playback-status")
            .and_then(|value| value.to_str().ok())
            .filter(|value| matches!(*value, "full" | "preview"))
            .unwrap_or("unknown")
            .to_owned()
    };
    let quality = response
        .headers()
        .get("x-mirai-quality")
        .and_then(|value| value.to_str().ok())
        .filter(|value| valid_quality(Some(value)))
        .map(str::to_owned);
    let root = directory(Path::new(&config.download_directory))?;
    let records = owned_directory(&root, DOWNLOAD_FOLDER)?;
    let token = nonce();
    let part = records.join(format!("{token}.part"));
    let record_part = records.join(format!("{token}.json.part"));
    let mut part_created = false;
    let mut record_created = false;
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&part)
            .map_err(|_| "无法创建下载临时文件。")?;
        part_created = true;
        let mut total = 0u64;
        let mut prefix = Vec::new();
        let mut buffer = [0u8; 65536];
        loop {
            let size = response
                .read(&mut buffer)
                .map_err(|_| "音频下载中断，未标记完成。")?;
            if size == 0 {
                break;
            }
            total += size as u64;
            if total > MAX_AUDIO_BYTES {
                return Err("音频超过 512MB 限制，已停止下载。".into());
            }
            if prefix.len() < 64 {
                prefix.extend_from_slice(&buffer[..size.min(64 - prefix.len())]);
            }
            file.write_all(&buffer[..size])
                .map_err(|_| "下载目录写入失败，请检查剩余空间。")?;
        }
        if total < 1024 || expected.is_some_and(|expected| expected != total) {
            return Err("下载字节数不完整，未标记完成。".into());
        }
        let extension = audio_extension(&prefix).ok_or("无法识别有效音频文件头，未标记完成。")?;
        file.sync_all().map_err(|_| "无法同步音频文件。")?;
        drop(file);
        let name = format!(
            "{} - {} [{}-{}-{token}].{extension}",
            clean_name(&input.title, 40),
            clean_name(&input.artist, 20),
            input.platform,
            input.id
        );
        let destination = root.join(&name);
        let record = DownloadedTrack {
            key: format!("{}:{}:{token}", input.platform, input.id),
            platform: input.platform.clone(),
            id: input.id.clone(),
            title: input.title.clone(),
            artist: input.artist.clone(),
            album: input.album.clone(),
            file_name: name,
            path: display_path(&destination),
            bytes: total,
            downloaded_at: timestamp(),
            status,
            quality,
        };
        let json = serde_json::to_vec(&record).map_err(|_| "无法编码下载记录。")?;
        let mut metadata = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&record_part)
            .map_err(|_| "无法写入下载记录。")?;
        record_created = true;
        metadata
            .write_all(&json)
            .and_then(|_| metadata.sync_all())
            .map_err(|_| "无法保存下载记录。")?;
        drop(metadata);
        publish_part(&part, &destination)?;
        publish_part(&record_part, &records.join(format!("{token}.json")))
            .map_err(|_| "音频已保存，但下载记录提交失败；请打开下载目录检查。".to_string())?;
        Ok(record)
    })();
    // 只删除本请求 create_new 创建的临时文件，从不删除已发布的下载文件。
    if result.is_err() {
        if part_created {
            let _ = fs::remove_file(&part);
        }
        if record_created {
            let _ = fs::remove_file(&record_part);
        }
    }
    result
}

// 原生统计在工作线程运行，不阻塞主窗口的播放与交互。
#[tauri::command]
pub(crate) async fn get_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    tauri::async_runtime::spawn_blocking(move || info_for(&config_for(&app)?))
        .await
        .map_err(|_| "读取存储统计失败。".to_string())?
}

// 下载进行中不允许切换配置，旧下载与歌单账户均保留不动。
#[tauri::command]
pub(crate) async fn update_storage_config(
    app: AppHandle,
    config: StorageConfigUpdate,
) -> Result<StorageInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<StorageState>();
        let _lock = state.mutation.lock().map_err(|_| "存储状态异常。")?;
        if state.downloading.load(Ordering::Acquire) {
            return Err("下载进行中不能切换目录。".into());
        }
        let old = load_config_unlocked(&app)?;
        let next = normalize_config(StorageConfig {
            cache_directory: config.cache_directory.unwrap_or(old.cache_directory),
            download_directory: config.download_directory.unwrap_or(old.download_directory),
        })?;
        save_config(&app, &next)?;
        info_for(&next)
    })
    .await
    .map_err(|_| "更新存储配置失败。".to_string())?
}

// 系统目录选择取消时返回空值，不擅自覆盖已保存配置。
#[tauri::command]
pub(crate) async fn choose_storage_directory(
    app: AppHandle,
    kind: String,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let config = config_for(&app)?;
        let (title, current) = match kind.as_str() {
            "cache" => ("选择 Mirai Music 缓存目录", config.cache_directory),
            "download" => ("选择 Mirai Music 下载目录", config.download_directory),
            _ => return Err("未知目录类型。".into()),
        };
        app.dialog()
            .file()
            .set_title(title)
            .set_directory(current)
            .blocking_pick_folder()
            .map(|file| {
                file.into_path()
                    .map(|path| display_path(&path))
                    .map_err(|_| "所选目录无效。".to_string())
            })
            .transpose()
    })
    .await
    .map_err(|_| "目录选择失败。".to_string())?
}

// 仅将已校验真实目录交给系统文件管理器，不执行 shell 拼接。
#[tauri::command]
pub(crate) async fn open_storage_directory(app: AppHandle, kind: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let config = config_for(&app)?;
        let path = match kind.as_str() {
            "cache" => owned_directory(Path::new(&config.cache_directory), CACHE_FOLDER)?,
            "download" => directory(Path::new(&config.download_directory))?,
            _ => return Err("未知目录类型。".into()),
        };
        app.opener()
            .open_path(display_path(&path), None::<&str>)
            .map_err(|_| "无法打开目录。".to_string())
    })
    .await
    .map_err(|_| "打开目录失败。".to_string())?
}

// 清理不递归、不跟随链接，只允许本应用拥有且名称匹配的音频缓存。
#[tauri::command]
pub(crate) async fn clear_audio_cache(app: AppHandle) -> Result<CacheClearResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<StorageState>();
        let _lock = state.mutation.lock().map_err(|_| "存储状态异常。")?;
        let config = normalize_config(load_config_unlocked(&app)?)?;
        let root = owned_directory(Path::new(&config.cache_directory), CACHE_FOLDER)?;
        let candidates = cache_candidates(&root)?;
        let mut result = CacheClearResult {
            removed_files: 0,
            removed_bytes: 0,
        };
        for (file, bytes) in candidates {
            let metadata = fs::symlink_metadata(&file).map_err(|_| "无法复核缓存条目。")?;
            if is_link(&metadata) || !metadata.is_file() || file.parent() != Some(root.as_path()) {
                continue;
            }
            fs::remove_file(&file).map_err(|_| "部分缓存无法清理，请关闭占用它的操作后重试。")?;
            result.removed_files += 1;
            result.removed_bytes += bytes;
        }
        Ok(result)
    })
    .await
    .map_err(|_| "缓存清理失败。".to_string())?
}

// 元数据列表仅返回仍然存在的实际下载文件。
#[tauri::command]
pub(crate) async fn list_downloads(app: AppHandle) -> Result<Vec<DownloadedTrack>, String> {
    tauri::async_runtime::spawn_blocking(move || downloads_for(&config_for(&app)?))
        .await
        .map_err(|_| "读取下载列表失败。".to_string())?
}

// 一次下载由后台工作线程执行，没有假进度、假暂停或假完成回调。
#[tauri::command]
pub(crate) async fn download_catalog_track(
    app: AppHandle,
    input: DownloadInput,
) -> Result<DownloadedTrack, String> {
    tauri::async_runtime::spawn_blocking(move || download_track(&app, input))
        .await
        .map_err(|_| "下载工作线程失败。".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    // 安全向量不创建或删除测试文件，避免误碰用户目录。
    #[test]
    fn cache_candidates_never_include_user_data() {
        assert!(cache_file_name(&format!("audio-{}.cache", "a".repeat(64))));
        for name in [
            "profiles.json",
            "playlists.json",
            "song.flac",
            ".owner",
            "audio-short.cache",
            "../audio-evil.cache",
            "audio-data.part",
        ] {
            assert!(!cache_file_name(name));
        }
    }

    // 平台曲目标识不能变成路径或命令片段。
    #[test]
    fn identity_rejects_paths_and_unknown_platforms() {
        assert!(valid_identity("netease", "123"));
        assert!(valid_identity("kugou", "a0bc123"));
        for value in ["../123", "a/b", "a\\b", "a:b", "", "hello world"] {
            assert!(!valid_identity("netease", value));
        }
        assert!(!valid_identity("other", "123"));
    }

    // 网络错误页面和截断文件不能仅靠扩展名冒充歌曲。
    #[test]
    fn audio_headers_reject_html_and_json() {
        assert_eq!(audio_extension(b"fLaC0000"), Some("flac"));
        assert_eq!(audio_extension(b"OggS0000"), Some("ogg"));
        assert_eq!(audio_extension(b"RIFF0000WAVE"), Some("wav"));
        assert_eq!(audio_extension(b"0000ftypM4A"), Some("m4a"));
        assert_eq!(audio_extension(b"ID30000"), Some("mp3"));
        assert_eq!(audio_extension(b"<!DOCTYPE html>"), None);
        assert_eq!(audio_extension(b"{\"detail\":{}}"), None);
        assert_eq!(audio_extension(b""), None);
    }

    // 下载文件名清除路径和 Windows 特殊字符，不使用外部响应里的文件名。
    #[test]
    fn filename_removes_path_characters() {
        assert_eq!(clean_name("../A/B\\C:*?", 70), "_A_B_C___");
        assert_eq!(clean_name("...", 70), "Untitled");
        assert_eq!(clean_name("中文歌曲", 70), "中文歌曲");
        assert_eq!(clean_name("123456", 3), "123");
    }

    // 后端调用固定使用配置 API，凭据或直链不进入请求。
    #[test]
    fn backend_rejects_credentials_and_direct_urls() {
        let input = DownloadInput {
            api_base_url: String::new(),
            platform: "netease".into(),
            id: "123".into(),
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            quality: None,
        };
        assert_eq!(
            backend_url("http://127.0.0.1:8000/api/v1", &input, "audio")
                .unwrap()
                .as_str(),
            "http://127.0.0.1:8000/api/v1/netease/tracks/123/audio"
        );
        for value in [
            "file:///tmp/a",
            "https://user:password@example.test/api/v1",
            "https://example.test/audio.mp3",
            "http://localhost/api/v1?secret=1",
            "http://localhost/api/v1#x",
        ] {
            assert!(backend_url(value, &input, "audio").is_err());
        }
        assert!(!valid_quality(Some("VIP-bypass")));
        assert!(valid_quality(Some("lossless")));
    }
}
