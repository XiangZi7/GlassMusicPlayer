use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};

/// 主窗口允许打开的桌面窗口类型，不接受任意窗口标签或外部地址。
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum DesktopWindowKind {
    Lyrics,
    Mini,
}

/// 一种桌面窗口的固定尺寸和标题，集中维护以保持原生窗口行为一致。
struct DesktopWindowOptions {
    label: &'static str,
    title: &'static str,
    width: f64,
    height: f64,
    min_width: f64,
    min_height: f64,
}

impl DesktopWindowKind {
    /// 按窗口用途读取配置；这些值只在 Rust 端定义。
    fn options(self) -> DesktopWindowOptions {
        match self {
            Self::Lyrics => DesktopWindowOptions {
                label: "lyrics",
                title: "Mirai · 桌面歌词",
                width: 600.0,
                height: 220.0,
                min_width: 450.0,
                min_height: 180.0,
            },
            Self::Mini => DesktopWindowOptions {
                label: "mini",
                title: "Mirai · 迷你播放器",
                width: 380.0,
                height: 300.0,
                min_width: 340.0,
                min_height: 280.0,
            },
        }
    }
}

/// 打开或恢复独立歌词窗、迷你播放器；恢复歌词窗时同步解除点击穿透。
#[tauri::command]
pub(crate) async fn open_desktop_window(
    app: AppHandle,
    kind: DesktopWindowKind,
) -> Result<(), String> {
    let options = kind.options();
    if let Some(window) = app.get_webview_window(options.label) {
        if matches!(kind, DesktopWindowKind::Lyrics) {
            window
                .set_ignore_cursor_events(false)
                .map_err(|error| format!("解除歌词窗口锁定失败：{error}"))?;
            window
                .emit("desktop-unlocked", ())
                .map_err(|error| format!("同步歌词窗口锁定状态失败：{error}"))?;
        }
        window
            .show()
            .map_err(|error| format!("显示窗口失败：{error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("聚焦窗口失败：{error}"))?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        options.label,
        WebviewUrl::App(format!("index.html#/desktop/{}", options.label).into()),
    )
    .title(options.title)
    .inner_size(options.width, options.height)
    .min_inner_size(options.min_width, options.min_height)
    .decorations(false)
    .always_on_top(true)
    .resizable(true)
    .center()
    .build()
    .map_err(|error| format!("创建桌面窗口失败：{error}"))?;
    Ok(())
}

/// 主窗口关闭时退出整个应用，避免独立小窗继续显示已经失效的播放状态。
pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() == "main" && matches!(event, WindowEvent::CloseRequested { .. }) {
        window.app_handle().exit(0);
    }
}
