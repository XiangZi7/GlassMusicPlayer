use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};

/// 主窗口设置控制迷你卡片，托盘左键恢复主窗口仍然可用。
pub(crate) struct TrayPreferences {
    enabled: AtomicBool,
}
impl Default for TrayPreferences {
    fn default() -> Self {
        Self {
            enabled: AtomicBool::new(true),
        }
    }
}
impl TrayPreferences {
    pub(crate) fn enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }
}

#[tauri::command]
pub(crate) fn set_tray_mini(
    app: AppHandle,
    preferences: State<'_, TrayPreferences>,
    enabled: bool,
) -> Result<(), String> {
    preferences.enabled.store(enabled, Ordering::Relaxed);
    if !enabled {
        if let Some(window) = app.get_webview_window("mini") {
            window
                .hide()
                .map_err(|error| format!("隐藏迷你播放器失败：{error}"))?;
        }
    }
    Ok(())
}

/// 使用真实系统托盘：右键松开直接展示迷你卡，左键恢复现有主窗口。
#[cfg(desktop)]
pub(crate) fn create(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let image = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| std::io::Error::other("缺少播放器托盘图标"))?;
    TrayIconBuilder::with_id("mirai-player-tray")
        .icon(image)
        .tooltip("Mirai Music · 右键打开迷你播放器")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|icon, event| {
            let TrayIconEvent::Click {
                button,
                button_state,
                position,
                ..
            } = event
            else {
                return;
            };
            if button_state != MouseButtonState::Up {
                return;
            }
            let app = icon.app_handle().clone();
            if button == MouseButton::Right && app.state::<TrayPreferences>().enabled() {
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = super::windows::show_desktop_window(
                        &app,
                        super::windows::DesktopWindowKind::Mini,
                        Some(position),
                    ) {
                        eprintln!("打开托盘迷你播放器失败：{error}");
                    }
                });
            } else if button == MouseButton::Left {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::TrayPreferences;
    use std::sync::atomic::Ordering;
    #[test]
    fn mini_preference_is_real_state() {
        let preferences = TrayPreferences::default();
        assert!(preferences.enabled());
        preferences.enabled.store(false, Ordering::Relaxed);
        assert!(!preferences.enabled());
    }
}
