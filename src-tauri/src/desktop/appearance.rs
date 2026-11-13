use tauri::{
    AppHandle, WebviewWindow, WebviewWindowBuilder,
    utils::config::{Color, WindowConfig},
};

/// 为 Windows 10 的外部软阴影留出透明区域，单位为逻辑像素。
const SHADOW_INSET: f64 = 24.0;

/// Windows 11 同样报告主版本 10，必须依据构建号区分；服务器不启用客户端外观。
#[cfg(any(target_os = "windows", test))]
fn needs_custom_frame(major: u32, build: u32, server: bool) -> bool {
    major == 10 && (10240..22000).contains(&build) && !server
}

/// 通过原生系统版本读取构建号，避免浏览器把 Windows 11 识别为 Windows 10。
#[cfg(target_os = "windows")]
fn is_windows_10() -> bool {
    let version = windows_version::OsVersion::current();
    needs_custom_frame(version.major, version.build, windows_version::is_server())
}

/// 其他系统沿用原生窗口外观，不添加 Windows 10 的补偿样式。
#[cfg(not(target_os = "windows"))]
fn is_windows_10() -> bool {
    false
}

/// 根据系统创建主窗口；Windows 10 使用透明阴影区域，Windows 11 使用系统圆角和阴影。
pub(crate) fn create_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or_else(|| std::io::Error::other("缺少主窗口配置"))?;
    create_window(app, config, None)?;
    Ok(())
}

/// 主窗口和设置弹窗共用系统外观策略，独立桌面卡片保留各自的配置。
pub(crate) fn create_window(
    app: &AppHandle,
    config: &WindowConfig,
    parent: Option<&WebviewWindow>,
) -> Result<WebviewWindow, Box<dyn std::error::Error>> {
    let mut builder = WebviewWindowBuilder::from_config(app, config)?;
    if let Some(parent) = parent {
        builder = builder.parent(parent)?;
    }

    if is_windows_10() {
        let frame = serde_json::json!({ "custom": true, "inset": SHADOW_INSET });
        builder = builder
            .transparent(true)
            .background_color(Color(0, 0, 0, 0))
            .shadow(false)
            .inner_size(
                config.width + SHADOW_INSET * 2.0,
                config.height + SHADOW_INSET * 2.0,
            )
            .initialization_script(format!("window.__MIRAI_WINDOW_FRAME__ = {frame};"));
        if let (Some(width), Some(height)) = (config.min_width, config.min_height) {
            builder =
                builder.min_inner_size(width + SHADOW_INSET * 2.0, height + SHADOW_INSET * 2.0);
        }
    } else {
        builder = builder.shadow(true);
    }

    let window = builder.build()?;
    #[cfg(target_os = "windows")]
    if is_windows_10() {
        if window.label() == "main" {
            super::shadow_hit_test::install(&window, SHADOW_INSET)?;
        } else {
            super::shadow_hit_test::add_window(&window, SHADOW_INSET)?;
        }
    }
    Ok(window)
}

#[cfg(test)]
mod tests {
    use super::needs_custom_frame;

    /// Windows 10 首发和当前常见构建都应补上圆角、阴影。
    #[test]
    fn windows_10_uses_custom_frame() {
        assert!(needs_custom_frame(10, 10240, false));
        assert!(needs_custom_frame(10, 19045, false));
    }

    /// Windows 11 的主版本仍是 10，构建号 22000 起必须交给系统处理。
    #[test]
    fn windows_11_keeps_native_frame() {
        assert!(!needs_custom_frame(10, 22000, false));
        assert!(!needs_custom_frame(10, 26100, false));
    }

    /// 其他版本、无法识别的版本和 Windows Server 不套用 Windows 10 样式。
    #[test]
    fn other_systems_keep_native_frame() {
        assert!(!needs_custom_frame(6, 9600, false));
        assert!(!needs_custom_frame(10, 0, false));
        assert!(!needs_custom_frame(10, 19045, true));
    }
}
