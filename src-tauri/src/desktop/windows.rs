use serde::Deserialize;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, Window, WindowEvent, utils::config::Color,
};

/// 只用于原稿卡片外的透明阴影画布，不改变卡片本身尺寸。
pub(crate) const SURFACE_INSET: f64 = 32.0;
static MINI_ANCHOR: Mutex<Option<PhysicalPosition<f64>>> = Mutex::new(None);

/// 主窗口只能打开本应用的三种桌面卡片。
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum DesktopWindowKind {
    Lyrics,
    Mini,
    Media,
}

struct DesktopWindowOptions {
    label: &'static str,
    title: &'static str,
    width: f64,
    height: f64,
    radius: f64,
}
impl DesktopWindowKind {
    fn options(self) -> DesktopWindowOptions {
        match self {
            Self::Lyrics => DesktopWindowOptions {
                label: "lyrics",
                title: "MiraiPlayer · 桌面歌词",
                width: 440.0,
                height: 178.0,
                radius: 16.0,
            },
            Self::Mini => DesktopWindowOptions {
                label: "mini",
                title: "MiraiPlayer · 迷你播放器",
                width: 324.0,
                height: 178.0,
                radius: 18.0,
            },
            Self::Media => DesktopWindowOptions {
                label: "media",
                title: "MiraiPlayer · 系统媒体控制",
                width: 368.0,
                height: 78.0,
                radius: 16.0,
            },
        }
    }
    fn from_label(label: &str) -> Option<Self> {
        match label {
            "lyrics" => Some(Self::Lyrics),
            "mini" => Some(Self::Mini),
            "media" => Some(Self::Media),
            _ => None,
        }
    }
}

/// 计算托盘附近的位置，含阴影的窗口边界也不能越出当前显示器。
fn popup_position(
    pointer: PhysicalPosition<f64>,
    size: PhysicalSize<u32>,
    origin: PhysicalPosition<i32>,
    monitor: PhysicalSize<u32>,
    scale: f64,
) -> PhysicalPosition<i32> {
    let margin = 8.0 * scale;
    let min_x = origin.x as f64 + margin;
    let min_y = origin.y as f64 + margin;
    let max_x = (origin.x as f64 + monitor.width as f64 - size.width as f64 - margin).max(min_x);
    let max_y = (origin.y as f64 + monitor.height as f64 - size.height as f64 - margin).max(min_y);
    let x = pointer.x - size.width as f64 + SURFACE_INSET * scale + 12.0 * scale;
    let above = pointer.y - size.height as f64 + SURFACE_INSET * scale - 16.0 * scale;
    let y = if above < min_y {
        pointer.y - SURFACE_INSET * scale + 16.0 * scale
    } else {
        above
    };
    PhysicalPosition::new(
        x.clamp(min_x, max_x).round() as i32,
        y.clamp(min_y, max_y).round() as i32,
    )
}

fn place_mini(window: &WebviewWindow, pointer: PhysicalPosition<f64>) -> Result<(), String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let monitor = monitors
        .into_iter()
        .find(|monitor| {
            let origin = monitor.position();
            let size = monitor.size();
            pointer.x >= origin.x as f64
                && pointer.y >= origin.y as f64
                && pointer.x < origin.x as f64 + size.width as f64
                && pointer.y < origin.y as f64 + size.height as f64
        })
        .or_else(|| window.current_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let current_scale = window.scale_factor().map_err(|error| error.to_string())?;
        let outer = window.outer_size().map_err(|error| error.to_string())?;
        let scale = monitor.scale_factor();
        let size = PhysicalSize::new(
            (outer.width as f64 / current_scale * scale).round() as u32,
            (outer.height as f64 / current_scale * scale).round() as u32,
        );
        window
            .set_position(popup_position(
                pointer,
                size,
                *monitor.position(),
                *monitor.size(),
                scale,
            ))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn apply_lock(window: &WebviewWindow, locked: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    super::shadow_hit_test::set_locked(window, locked).map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(locked)
        .map_err(|error| error.to_string())
}

/// 缓存原生卡片；从托盘打开时使用实际鼠标位置，不另建播放器。
pub(crate) fn show_desktop_window(
    app: &AppHandle,
    kind: DesktopWindowKind,
    anchor: Option<PhysicalPosition<f64>>,
) -> Result<(), String> {
    if matches!(kind, DesktopWindowKind::Mini)
        && !app.state::<super::tray::TrayPreferences>().enabled()
    {
        return Err("迷你播放器已在设置中关闭。".into());
    }
    let options = kind.options();
    let window = if let Some(window) = app.get_webview_window(options.label) {
        window
    } else {
        let window = WebviewWindowBuilder::new(
            app,
            options.label,
            WebviewUrl::App(format!("index.html#/desktop/{}", options.label).into()),
        )
        .title(options.title)
        .inner_size(
            options.width + SURFACE_INSET * 2.0,
            options.height + SURFACE_INSET * 2.0,
        )
        .min_inner_size(
            options.width + SURFACE_INSET * 2.0,
            48.0 + SURFACE_INSET * 2.0,
        )
        .decorations(false)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .focused(false)
        .center()
        .build()
        .map_err(|error| format!("创建桌面窗口失败：{error}"))?;
        #[cfg(target_os = "windows")]
        super::shadow_hit_test::add_surface_window(&window, SURFACE_INSET, options.radius)
            .map_err(|error| error.to_string())?;
        window
    };
    if matches!(kind, DesktopWindowKind::Lyrics) {
        apply_lock(&window, false)?;
        app.emit_to("main", "desktop-unlocked", ())
            .map_err(|error| error.to_string())?;
    }
    if matches!(kind, DesktopWindowKind::Mini) {
        if let Some(anchor) = anchor {
            *MINI_ANCHOR.lock().map_err(|_| "迷你窗口位置状态不可用")? = Some(anchor);
        }
        if let Some(anchor) = *MINI_ANCHOR.lock().map_err(|_| "迷你窗口位置状态不可用")?
        {
            place_mini(&window, anchor)?;
        }
    }
    window
        .show()
        .map_err(|error| format!("显示窗口失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦窗口失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn open_desktop_window(
    app: AppHandle,
    kind: DesktopWindowKind,
) -> Result<(), String> {
    show_desktop_window(&app, kind, None)
}

/// 只允许桌面卡片调整自己的内容高度，宽度由原稿确定。
#[tauri::command]
pub(crate) fn resize_desktop_surface(
    window: WebviewWindow,
    content_height: f64,
) -> Result<(), String> {
    let kind = DesktopWindowKind::from_label(window.label()).ok_or("此窗口不是桌面卡片")?;
    if !content_height.is_finite() || !(48.0..=520.0).contains(&content_height) {
        return Err("桌面卡片高度无效".into());
    }
    let options = kind.options();
    window
        .set_size(LogicalSize::new(
            options.width + SURFACE_INSET * 2.0,
            content_height.ceil() + SURFACE_INSET * 2.0,
        ))
        .map_err(|error| error.to_string())?;
    if matches!(kind, DesktopWindowKind::Mini) {
        if let Some(anchor) = *MINI_ANCHOR.lock().map_err(|_| "迷你窗口位置状态不可用")?
        {
            place_mini(&window, anchor)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn set_desktop_lock(window: WebviewWindow, locked: bool) -> Result<(), String> {
    if window.label() != "lyrics" {
        return Err("只有歌词窗口支持点击穿透锁定".into());
    }
    apply_lock(&window, locked)
}

/// 用隐藏和恢复保留灵动岛拖动后的位置，首次打开时创建独立置顶窗口。
#[tauri::command]
pub(crate) async fn set_lyric_island(app: AppHandle, visible: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("island") {
        return if visible {
            window.show()
        } else {
            window.hide()
        }
        .map_err(|error| format!("切换灵动岛显示状态失败：{error}"));
    }
    if !visible {
        return Ok(());
    }
    let window = WebviewWindowBuilder::new(
        &app,
        "island",
        WebviewUrl::App("index.html#/desktop/island".into()),
    )
    .title("MiraiPlayer · 灵动岛")
    // 胶囊本体继续为 320 × 40；外面留透明阴影，不拉伸成矩形卡片。
    .inner_size(320.0 + SURFACE_INSET * 2.0, 40.0 + SURFACE_INSET * 2.0)
    .decorations(false)
    .transparent(true)
    .background_color(Color(0, 0, 0, 0))
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .resizable(false)
    .center()
    .build()
    .map_err(|error| format!("创建灵动岛窗口失败：{error}"))?;
    #[cfg(target_os = "windows")]
    super::shadow_hit_test::add_surface_window(&window, SURFACE_INSET, 20.0)
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// 按通用设置关闭主窗口，桌面小窗沿用各自的隐藏和失焦行为。
pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    super::tray_menu::handle_window_event(window, event);
    #[cfg(target_os = "windows")]
    if matches!(event, WindowEvent::Destroyed) {
        super::shadow_hit_test::remove_window(window);
    }
    #[cfg(target_os = "windows")]
    if matches!(
        event,
        WindowEvent::Moved(_)
            | WindowEvent::Resized(_)
            | WindowEvent::ScaleFactorChanged { .. }
            | WindowEvent::Focused(true)
    ) {
        super::shadow_hit_test::refresh();
    }
    if window.label() == "mini" && matches!(event, WindowEvent::Focused(false)) {
        let _ = window.hide();
    }
    if let WindowEvent::CloseRequested { api, .. } = event {
        if DesktopWindowKind::from_label(window.label()).is_some() || window.label() == "island" {
            // 小窗的菜单/Escape 只收起当前表面；缓存快照和拖动位置供后续重开。
            api.prevent_close();
            let _ = window.hide();
        } else if window.label() == "main" {
            let app = window.app_handle();
            #[cfg(desktop)]
            if app.state::<super::tray::TrayPreferences>().close_to_tray()
                && app.tray_by_id(super::tray::TRAY_ICON_ID).is_some()
            {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("收起主播放器到托盘失败：{error}");
                }
                return;
            }
            app.exit(0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn surface_dimensions_follow_original_cards() {
        for (kind, width, radius) in [
            (DesktopWindowKind::Lyrics, 440.0, 16.0),
            (DesktopWindowKind::Mini, 324.0, 18.0),
            (DesktopWindowKind::Media, 368.0, 16.0),
        ] {
            let options = kind.options();
            assert_eq!(options.width, width);
            assert_eq!(options.radius, radius);
            assert_eq!(options.width + SURFACE_INSET * 2.0, width + 64.0);
        }
        assert_eq!(SURFACE_INSET, 32.0);
    }
    #[test]
    fn tray_popup_stays_on_monitor() {
        let size = PhysicalSize::new(388, 242);
        let origin = PhysicalPosition::new(0, 0);
        let monitor = PhysicalSize::new(1920, 1080);
        for pointer in [
            PhysicalPosition::new(1910.0, 1060.0),
            PhysicalPosition::new(4.0, 4.0),
        ] {
            let result = popup_position(pointer, size, origin, monitor, 1.0);
            assert!(result.x >= 8 && result.y >= 8);
            assert!(result.x + size.width as i32 <= 1912 && result.y + size.height as i32 <= 1072);
        }
    }
    #[test]
    fn tray_anchor_gap_tracks_dpi_and_current_canvas() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let size = PhysicalSize::new((388.0 * scale) as u32, (242.0 * scale) as u32);
            let pointer = PhysicalPosition::new(1800.0 * scale, 980.0 * scale);
            let result = popup_position(
                pointer,
                size,
                PhysicalPosition::new(0, 0),
                PhysicalSize::new((1920.0 * scale) as u32, (1080.0 * scale) as u32),
                scale,
            );
            let card_right = result.x as f64 + size.width as f64 - SURFACE_INSET * scale;
            let card_bottom = result.y as f64 + size.height as f64 - SURFACE_INSET * scale;
            assert!((card_right - pointer.x - 12.0 * scale).abs() <= 0.5);
            assert!((pointer.y - card_bottom - 16.0 * scale).abs() <= 0.5);
        }
    }
    #[test]
    fn negative_origin_and_dpi_are_supported() {
        let result = popup_position(
            PhysicalPosition::new(-1800.0, 1040.0),
            PhysicalSize::new(582, 363),
            PhysicalPosition::new(-1920, 0),
            PhysicalSize::new(1920, 1080),
            1.5,
        );
        assert!(result.x >= -1908 && result.x + 582 <= -12);
        assert!(result.y >= 12 && result.y + 363 <= 1068);
    }
}
