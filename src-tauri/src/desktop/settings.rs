use tauri::{AppHandle, Manager, WebviewUrl, utils::config::WindowConfig};

/// 串行创建和恢复，避免快速连续点击产生同名窗口或重复创建提示。
static OPEN_SETTINGS: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// 打开主窗口所属的原生设置弹窗；窗口内容由同一套 Vue 组件渲染。
#[tauri::command]
pub(crate) async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    let _guard = OPEN_SETTINGS
        .lock()
        .map_err(|_| "设置窗口状态异常，请重试")?;
    if let Some(window) = app.get_webview_window("settings") {
        window
            .unminimize()
            .map_err(|error| format!("恢复设置窗口失败：{error}"))?;
        window
            .show()
            .map_err(|error| format!("显示设置窗口失败：{error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("聚焦设置窗口失败：{error}"))?;
        return Ok(());
    }
    let main = app.get_webview_window("main").ok_or("主窗口尚未创建")?;
    let config = WindowConfig {
        label: "settings".into(),
        title: "设置 · Mirai Music".into(),
        url: WebviewUrl::App("index.html#/settings".into()),
        width: 860.0,
        height: 740.0,
        min_width: Some(680.0),
        min_height: Some(520.0),
        decorations: false,
        drag_drop_enabled: false,
        center: true,
        skip_taskbar: true,
        ..Default::default()
    };
    super::appearance::create_window(&app, &config, Some(&main))
        .map_err(|error| format!("创建设置窗口失败：{error}"))?;
    Ok(())
}
