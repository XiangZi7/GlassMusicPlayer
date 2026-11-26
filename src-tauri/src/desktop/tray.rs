use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewWindow, Wry,
    menu::{MenuBuilder, MenuItem},
};

pub(crate) const TRAY_ICON_ID: &str = "mirai-player-tray";

/// 保存原生窗口关闭动作和托盘菜单所需的当前偏好。
pub(crate) struct TrayPreferences {
    enabled: AtomicBool,
    close_to_tray: AtomicBool,
    mini_item: Mutex<Option<MenuItem<Wry>>>,
    anchor: Mutex<Option<PhysicalPosition<f64>>>,
}
impl Default for TrayPreferences {
    /// 偏好恢复前保留播放器在托盘运行，避免启动时关闭窗口直接退出。
    fn default() -> Self {
        Self {
            enabled: AtomicBool::new(true),
            close_to_tray: AtomicBool::new(true),
            mini_item: Mutex::new(None),
            anchor: Mutex::new(None),
        }
    }
}
impl TrayPreferences {
    /// 主窗口关闭时读取已应用的后台运行偏好。
    pub(crate) fn close_to_tray(&self) -> bool {
        self.close_to_tray.load(Ordering::Relaxed)
    }

    pub(crate) fn enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }
    pub(crate) fn anchor(&self) -> Option<PhysicalPosition<f64>> {
        self.anchor.lock().ok().and_then(|value| *value)
    }
}

/// 主窗口恢复已保存偏好，设置窗口在应用或保存草稿时更新原生关闭行为。
#[tauri::command]
pub(crate) fn set_close_to_tray(
    window: WebviewWindow,
    preferences: State<'_, TrayPreferences>,
    enabled: bool,
) -> Result<(), String> {
    if !matches!(window.label(), "main" | "settings") {
        return Err("只有播放器和设置窗口可以修改关闭行为".into());
    }
    preferences.close_to_tray.store(enabled, Ordering::Relaxed);
    Ok(())
}

/// 同步原生菜单的迷你播放器开关，关闭时收起已打开的窗口并安排回收。
#[tauri::command]
pub(crate) async fn set_tray_mini(app: AppHandle, enabled: bool) -> Result<(), String> {
    let preferences = app.state::<TrayPreferences>();
    preferences.enabled.store(enabled, Ordering::Relaxed);
    let item = preferences
        .mini_item
        .lock()
        .map_err(|_| "托盘菜单状态不可用")?
        .clone();
    if let Some(item) = item {
        item.set_enabled(enabled)
            .map_err(|error| format!("更新托盘菜单失败：{error}"))?;
    }
    if !enabled {
        super::windows::hide_disabled_mini(&app).await?;
    }
    Ok(())
}

fn desktop_menu_kind(id: &str) -> Option<super::windows::DesktopWindowKind> {
    use super::windows::DesktopWindowKind;
    match id {
        "tray-mini" => Some(DesktopWindowKind::Mini),
        "tray-lyrics" => Some(DesktopWindowKind::Lyrics),
        "tray-media" => Some(DesktopWindowKind::Media),
        _ => None,
    }
}

pub(crate) fn focus_main(app: &AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("主播放器窗口不可用")?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

/// Windows 的 WebView 就绪后换成同主题菜单；其他平台及失败时保留原生入口。
#[cfg(desktop)]
pub(crate) fn create(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // 通知区使用头像近景，缩到小尺寸时仍能辨认眼镜和脸部。
    let image = tauri::include_image!("./icons/tray.png");
    let mini_item = MenuItem::with_id(app, "tray-mini", "迷你播放器", true, None::<&str>)?;
    let menu = MenuBuilder::new(app)
        .text("tray-main", "打开主播放器")
        .text("tray-toggle", "播放 / 暂停")
        .separator()
        .item(&mini_item)
        .text("tray-lyrics", "桌面歌词")
        .text("tray-media", "媒体控制卡片")
        .separator()
        .text("tray-settings", "设置")
        .text("tray-exit", "退出播放器")
        .build()?;
    *app.state::<TrayPreferences>()
        .mini_item
        .lock()
        .map_err(|_| std::io::Error::other("托盘菜单状态不可用"))? = Some(mini_item);
    super::tray_menu::remember_native_menu(app.handle(), &menu)?;
    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(image)
        .tooltip("MiraiPlayer · 右键打开桌面菜单")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if let Some(kind) = desktop_menu_kind(id) {
                let anchor = app
                    .state::<TrayPreferences>()
                    .anchor
                    .lock()
                    .ok()
                    .and_then(|value| *value);
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) =
                        super::windows::show_desktop_window(&app, kind, anchor).await
                    {
                        eprintln!("打开托盘桌面窗口失败：{error}");
                    }
                });
            } else if id == "tray-main" {
                if let Err(error) = focus_main(app) {
                    eprintln!("恢复主播放器失败：{error}");
                }
            } else if id == "tray-toggle" {
                let _ = app.emit_to(
                    "main",
                    "player-action",
                    serde_json::json!({ "type": "toggle" }),
                );
            } else if id == "tray-settings" {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = super::settings::open_settings_window(app).await {
                        eprintln!("打开设置窗口失败：{error}");
                    }
                });
            } else if id == "tray-exit" {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|icon, event| {
            let TrayIconEvent::Click {
                button,
                button_state,
                position,
                rect,
                ..
            } = event
            else {
                return;
            };
            if button_state != MouseButtonState::Up {
                return;
            }
            let app = icon.app_handle();
            if button == MouseButton::Right {
                if let Ok(mut anchor) = app.state::<TrayPreferences>().anchor.lock() {
                    *anchor = Some(position);
                }
                if super::tray_menu::is_ready(app) {
                    // 在 UI 回调里捕获开合代号，不能等 async 任务启动后才记录打开意图。
                    match super::tray_menu::request_open(app, position, rect) {
                        Ok(Some(request)) => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(error) = super::tray_menu::show(&app, request).await {
                                    eprintln!("打开自定义托盘菜单失败：{error}");
                                    let _ = super::tray_menu::restore_native_menu_async(&app).await;
                                }
                            });
                        }
                        Ok(None) => {}
                        Err(error) => {
                            eprintln!("记录托盘菜单位置失败：{error}");
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = super::tray_menu::restore_native_menu_async(&app).await;
                            });
                        }
                    }
                } else {
                    // 首次右键由已连接的原生菜单承接，自定义菜单就绪后供下次打开。
                    #[cfg(target_os = "windows")]
                    super::tray_menu::prepare_window(app);
                }
                // ready 前原生菜单保持可用，ready 后只弹缓存的自定义菜单，不打开 mini。
            } else if button == MouseButton::Left {
                super::tray_menu::cancel_pending(app);
                if let Err(error) = focus_main(app) {
                    eprintln!("恢复主播放器失败：{error}");
                }
            }
        })
        .build(app)?;
    Ok(())
}
