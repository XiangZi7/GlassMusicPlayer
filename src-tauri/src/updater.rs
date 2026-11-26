use semver::Version;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{Manager, Url, WebviewWindow};
use tauri_plugin_updater::UpdaterExt;

const RELEASES: &str = "https://github.com/XiangZi7/MiraiPlayer/releases";
const PUBLIC_KEY: Option<&str> = option_env!("TAURI_UPDATER_PUBLIC_KEY");

/// 限定清单与安装包来自 MiraiPlayer 的 GitHub Releases，代理只能转发 HTTPS。
fn release_url(prefix: &str, original: &str) -> Result<Url, String> {
    if !original.starts_with(&format!("{RELEASES}/")) {
        return Err("发行文件不属于 MiraiPlayer".into());
    }
    let target = Url::parse(original).map_err(|error| error.to_string())?;
    if !target.path().starts_with("/XiangZi7/MiraiPlayer/releases/")
        || target.query().is_some()
        || target.fragment().is_some()
    {
        return Err("发行文件地址无效".into());
    }
    if prefix.is_empty() {
        return Ok(target);
    }
    let base = Url::parse(prefix).map_err(|_| "更新代理地址无效")?;
    if base.scheme() != "https"
        || base.host_str().is_none()
        || !base.username().is_empty()
        || base.password().is_some()
        || base.query().is_some()
        || base.fragment().is_some()
    {
        return Err("请填写不带凭据、查询参数或片段的 HTTPS 代理地址".into());
    }
    Url::parse(&format!(
        "{}/{}",
        base.as_str().trim_end_matches('/'),
        target
    ))
    .map_err(|error| error.to_string())
}

/// 只有已安装的 Windows、macOS 应用和 Linux AppImage 能用签名包原地升级。
fn can_install() -> bool {
    if cfg!(debug_assertions) || PUBLIC_KEY.is_none_or(|key| key.trim().is_empty()) {
        return false;
    }
    let executable = std::env::current_exe().ok();
    if cfg!(all(windows, target_arch = "x86_64")) {
        return executable
            .as_ref()
            .and_then(|exe| exe.parent())
            .is_some_and(|dir| dir.join("uninstall.exe").is_file());
    }
    if cfg!(all(
        target_os = "macos",
        any(target_arch = "x86_64", target_arch = "aarch64")
    )) {
        return executable.as_ref().is_some_and(|exe| {
            exe.parent()
                .is_some_and(|dir| dir.ends_with("Contents/MacOS"))
                && !exe.starts_with("/Volumes")
        });
    }
    cfg!(all(target_os = "linux", target_arch = "x86_64"))
        && std::env::var_os("APPIMAGE").is_some_and(|path| std::path::Path::new(&path).is_file())
}

/// 向关于页说明当前安装方式能否接收签名包，所有环境均可手动检查。
#[tauri::command]
pub(crate) fn updater_can_install() -> bool {
    can_install()
}

#[derive(Deserialize)]
struct Release {
    name: String,
    version: String,
    tag: String,
    prerelease: bool,
    #[serde(default)]
    updater: bool,
}

/// 验证发行来源及正式版标签，开发中或预发布版本不会被降级。
fn newer_release(release: &Release, installed: &Version) -> Result<bool, String> {
    let version = Version::parse(&release.version).map_err(|_| "发行版本号无效")?;
    if release.name != "MiraiPlayer"
        || release.tag != format!("v{version}")
        || release.prerelease
        || !version.pre.is_empty()
        || !version.build.is_empty()
    {
        return Err("未取得 MiraiPlayer 正式版的发行信息".into());
    }
    Ok(version > *installed)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateMetadata {
    rid: tauri::ResourceId,
    current_version: String,
    version: String,
    raw_json: serde_json::Value,
}

#[derive(Serialize)]
pub(crate) struct ReleaseUpdate {
    version: String,
    package: Option<UpdateMetadata>,
}

/// 主窗口读取发行元数据，旧版无签名清单及便携包仍能发现新版本。
#[tauri::command]
pub(crate) async fn updater_check_source(
    window: WebviewWindow,
    prefix: String,
) -> Result<Option<ReleaseUpdate>, String> {
    if window.label() != "main" {
        return Err("仅主窗口可以检查发行版本".into());
    }
    let timeout = Duration::from_secs(12);
    let url = release_url(&prefix, &format!("{RELEASES}/latest/download/version.json"))?;
    let mut response = reqwest::Client::builder()
        .https_only(true)
        .connect_timeout(Duration::from_secs(5))
        .timeout(timeout)
        .user_agent(concat!("MiraiPlayer/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if bytes.len() + chunk.len() > 32 * 1024 {
            return Err("发行版本信息过大".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let release: Release = serde_json::from_slice(&bytes).map_err(|_| "发行版本信息无效")?;
    if !newer_release(&release, &window.package_info().version)? {
        return Ok(None);
    }
    let mut result = ReleaseUpdate {
        version: release.version,
        package: None,
    };
    if release.updater && can_install() {
        let directory = format!("{RELEASES}/download/{}/", release.tag);
        let endpoint = release_url(&prefix, &format!("{directory}latest.json"))?;
        let updater = window
            .updater_builder()
            .pubkey(PUBLIC_KEY.unwrap_or_default().trim())
            .endpoints(vec![endpoint])
            .map_err(|e| e.to_string())?
            .timeout(timeout)
            .build()
            .map_err(|e| e.to_string())?;
        let mut update = updater
            .check()
            .await
            .map_err(|e| e.to_string())?
            .ok_or("签名清单与发行版本不匹配")?;
        if update.version != result.version || !update.download_url.as_str().starts_with(&directory)
        {
            return Err("签名清单中的安装包与发行版本不匹配".into());
        }
        update.download_url = release_url(&prefix, update.download_url.as_str())?;
        result.package = Some(UpdateMetadata {
            current_version: update.current_version.clone(),
            version: update.version.clone(),
            raw_json: update.raw_json.clone(),
            rid: window.resources_table().add(update),
        });
    }
    Ok(Some(result))
}

/// Windows 由 NSIS 安装器重启，其他受支持的打包应用在安装成功后重启。
#[tauri::command]
pub(crate) fn updater_restart(window: WebviewWindow) -> Result<(), String> {
    if window.label() != "main" || !can_install() {
        return Err("当前安装方式不支持应用内重启更新".into());
    }
    #[cfg(not(windows))]
    window.app_handle().request_restart();
    Ok(())
}
