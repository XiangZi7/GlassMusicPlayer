use serde::Deserialize;
use std::{
    sync::{LazyLock, Mutex},
    time::Duration,
};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, Window, WindowEvent, utils::config::Color,
};
use tokio::sync::{Mutex as AsyncMutex, Notify, oneshot};

/// 只用于原稿卡片外的透明阴影画布，不改变卡片本身尺寸。
pub(crate) const SURFACE_INSET: f64 = 32.0;
const CARD_IDLE_TIMEOUT: Duration = Duration::from_secs(60);
static CARD_CACHE: LazyLock<[CardCache; 3]> = LazyLock::new(Default::default);

#[derive(Default)]
struct CardCache {
    // 原生创建和异步销毁必须串行，隐藏等 UI 事件不持有此锁。
    operation: AsyncMutex<()>,
    // 最近一次隐藏、回收前的物理坐标以及托盘定位记录。
    state: Mutex<CardState>,
    // 收到 Destroyed 后，同名窗口已经从 Tauri 管理器中移除。
    destroyed: Notify,
}

#[derive(Default)]
struct CardState {
    revision: u64,
    cancel_idle: Option<oneshot::Sender<()>>,
    saved_position: Option<PhysicalPosition<i32>>,
    // 仅对由托盘定位且之后未被手动拖动的 mini 贴靠图标。
    tray_anchor: Option<(PhysicalPosition<f64>, PhysicalPosition<i32>)>,
}

impl CardState {
    /// 作废旧倒计时，已经开始等待操作锁的旧回收也要重新核对代号。
    fn cancel_release(&mut self) {
        self.revision = self.revision.wrapping_add(1);
        self.cancel_idle = None;
    }

    /// 从首次隐藏开始计时，随后重复的失焦或关闭事件不推迟回收。
    fn begin_release(&mut self) -> Option<(u64, oneshot::Receiver<()>)> {
        if self.cancel_idle.is_some() {
            return None;
        }
        let (cancel, receiver) = oneshot::channel();
        self.cancel_idle = Some(cancel);
        Some((self.revision, receiver))
    }

    /// 从托盘首次定位后只跟随未拖动的窗口；卡片已移走时恢复用户位置。
    fn anchored_at(&mut self, position: PhysicalPosition<i32>) -> Option<PhysicalPosition<f64>> {
        self.tray_anchor = self.tray_anchor.filter(|(_, placed)| *placed == position);
        self.tray_anchor.map(|(pointer, _)| pointer)
    }
}

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
    /// 每种桌面卡片分别记录隐藏期限和位置，互不阻塞其他卡片的开合。
    fn cache(self) -> &'static CardCache {
        &CARD_CACHE[self as usize]
    }

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

/// 靠近图标放置迷你播放器，记下实际位置以识别之后的用户拖动。
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
        let position = popup_position(pointer, size, *monitor.position(), *monitor.size(), scale);
        window
            .set_position(position)
            .map_err(|error| error.to_string())?;
        let placed = window.outer_position().map_err(|error| error.to_string())?;
        DesktopWindowKind::Mini
            .cache()
            .state
            .lock()
            .unwrap()
            .tray_anchor = Some((pointer, placed));
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

/// 桌面卡片隐藏一分钟后释放 WebView，短时重开取消倒计时并沿用原窗口。
pub(crate) fn schedule_card_release(app: &AppHandle, kind: DesktopWindowKind) {
    let cache = kind.cache();
    let Some((revision, cancelled)) = cache.state.lock().unwrap().begin_release() else {
        return;
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if tokio::time::timeout(CARD_IDLE_TIMEOUT, cancelled)
            .await
            .is_ok()
        {
            return;
        }
        let _operation = cache.operation.lock().await;
        if cache.state.lock().unwrap().revision != revision {
            return;
        }
        if let Err(error) = release_hidden_card(&app, kind).await {
            eprintln!("回收隐藏的 {} 窗口失败：{error}", kind.options().label);
        }
        cache.state.lock().unwrap().cancel_release();
    });
}

/// 在同类窗口的操作锁内保留准确坐标后销毁，原生查询失败时留待下次隐藏重试。
async fn release_hidden_card(app: &AppHandle, kind: DesktopWindowKind) -> tauri::Result<()> {
    let label = kind.options().label;
    let Some(window) = app.get_webview_window(label) else {
        return Ok(());
    };
    if window.is_visible()? {
        return Ok(());
    }
    let position = window.outer_position()?;
    let cache = kind.cache();
    window.destroy()?;
    {
        let mut state = cache.state.lock().unwrap();
        state.saved_position = Some(position);
        state.tray_anchor = None;
    }
    // destroy 投递到原生事件队列；同名窗口再次创建前须等待旧窗口真正销毁。
    while app.get_webview_window(label).is_some() {
        cache.destroyed.notified().await;
    }
    Ok(())
}

/// 回收后的桌面卡片回到上次位置；原显示器已断开时沿用新窗口的居中位置。
fn restore_card_position(
    window: &WebviewWindow,
    position: PhysicalPosition<i32>,
) -> tauri::Result<()> {
    let size = window.outer_size()?;
    let x = i64::from(position.x) + i64::from(size.width) / 2;
    let y = i64::from(position.y) + i64::from(size.height) / 2;
    if window.available_monitors()?.iter().any(|monitor| {
        let area = monitor.work_area();
        let left = i64::from(area.position.x);
        let top = i64::from(area.position.y);
        (left..left + i64::from(area.size.width)).contains(&x)
            && (top..top + i64::from(area.size.height)).contains(&y)
    }) {
        window.set_position(position)?;
    }
    Ok(())
}

/// 短时复用原生卡片，超时后按保存的位置重建，从托盘打开时优先定位到图标。
pub(crate) async fn show_desktop_window(
    app: &AppHandle,
    kind: DesktopWindowKind,
    anchor: Option<PhysicalPosition<f64>>,
) -> Result<(), String> {
    let cache = kind.cache();
    let _operation = cache.operation.lock().await;
    if matches!(kind, DesktopWindowKind::Mini)
        && !app.state::<super::tray::TrayPreferences>().enabled()
    {
        return Err("迷你播放器已在设置中关闭。".into());
    }
    let saved_position = {
        let mut state = cache.state.lock().unwrap();
        state.cancel_release();
        state.saved_position
    };
    let options = kind.options();
    let window = if let Some(window) = app.get_webview_window(options.label) {
        window
    } else {
        let window = super::appearance::configure_webview(WebviewWindowBuilder::new(
            app,
            options.label,
            WebviewUrl::App(format!("index.html#/desktop/{}", options.label).into()),
        ))
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
        if let Some(position) = saved_position {
            if let Err(error) = restore_card_position(&window, position) {
                eprintln!("恢复桌面卡片位置失败：{error}");
            }
        }
        window
    };
    if matches!(kind, DesktopWindowKind::Lyrics) {
        apply_lock(&window, false)?;
        app.emit_to("main", "desktop-unlocked", ())
            .map_err(|error| error.to_string())?;
    }
    if matches!(kind, DesktopWindowKind::Mini) {
        if let Some(anchor) = anchor {
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
    show_desktop_window(&app, kind, None).await
}

/// 等待在途打开完成后再应用关闭偏好，禁用时同时开始计时释放迷你卡片。
pub(crate) async fn hide_disabled_mini(app: &AppHandle) -> Result<(), String> {
    let kind = DesktopWindowKind::Mini;
    let _operation = kind.cache().operation.lock().await;
    if !app.state::<super::tray::TrayPreferences>().enabled() {
        if let Some(window) = app.get_webview_window(kind.options().label) {
            window
                .hide()
                .map_err(|error| format!("隐藏迷你播放器失败：{error}"))?;
            schedule_card_release(app, kind);
        }
    }
    Ok(())
}

/// 只允许桌面卡片调整自己的内容高度，宽度由原稿确定。
#[tauri::command]
pub(crate) async fn resize_desktop_surface(
    window: WebviewWindow,
    content_height: f64,
) -> Result<(), String> {
    let kind = DesktopWindowKind::from_label(window.label()).ok_or("此窗口不是桌面卡片")?;
    if !content_height.is_finite() || !(48.0..=520.0).contains(&content_height) {
        return Err("桌面卡片高度无效".into());
    }
    let cache = kind.cache();
    let _operation = cache.operation.lock().await;
    let anchor = if matches!(kind, DesktopWindowKind::Mini) {
        let position = window.outer_position().map_err(|error| error.to_string())?;
        cache.state.lock().unwrap().anchored_at(position)
    } else {
        None
    };
    let options = kind.options();
    window
        .set_size(LogicalSize::new(
            options.width + SURFACE_INSET * 2.0,
            content_height.ceil() + SURFACE_INSET * 2.0,
        ))
        .map_err(|error| error.to_string())?;
    if let Some(anchor) = anchor {
        place_mini(&window, anchor)?;
    }
    Ok(())
}

/// 从歌词窗口应用锁定状态，其他桌面卡片不能改变其交互方式。
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
    let _window = super::appearance::configure_webview(WebviewWindowBuilder::new(
        &app,
        "island",
        WebviewUrl::App("index.html#/desktop/island".into()),
    ))
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
    super::shadow_hit_test::add_surface_window(&_window, SURFACE_INSET, 20.0)
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// 按通用设置关闭主窗口，桌面小窗沿用各自的隐藏和失焦行为。
pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    super::tray_menu::handle_window_event(window, event);
    let card = DesktopWindowKind::from_label(window.label());
    if matches!(event, WindowEvent::Destroyed) {
        if let Some(kind) = card {
            kind.cache().destroyed.notify_one();
        }
    }
    #[cfg(target_os = "windows")]
    if matches!(event, WindowEvent::Destroyed) {
        if window.label() == "main" {
            super::media_session::release(window.app_handle());
        }
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
        if window.hide().is_ok() {
            schedule_card_release(window.app_handle(), DesktopWindowKind::Mini);
        }
    }
    if let WindowEvent::CloseRequested { api, .. } = event {
        if card.is_some() || window.label() == "island" {
            // 短时隐藏保留快开；灵动岛由独立偏好控制，普通桌面卡片超时回收。
            api.prevent_close();
            if window.hide().is_ok() {
                if let Some(kind) = card {
                    schedule_card_release(window.app_handle(), kind);
                }
            }
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
mod card_cache_tests {
    use super::*;

    /// 连续收起、重开使旧计时器失效，已记录的位置可供新窗口复用。
    #[test]
    fn reopening_cancels_only_the_pending_release() {
        let mut state = CardState {
            saved_position: Some(PhysicalPosition::new(-458, 260)),
            ..Default::default()
        };
        let (first, mut cancelled) = state.begin_release().unwrap();
        assert!(state.begin_release().is_none());
        state.cancel_release();
        assert_eq!(
            cancelled.try_recv(),
            Err(oneshot::error::TryRecvError::Closed)
        );
        let (second, mut latest) = state.begin_release().unwrap();
        assert_ne!(first, second);
        assert_eq!(latest.try_recv(), Err(oneshot::error::TryRecvError::Empty));
        state.cancel_release();
        assert_eq!(latest.try_recv(), Err(oneshot::error::TryRecvError::Closed));
        assert_ne!(second, state.revision);
        assert_eq!(state.saved_position, Some(PhysicalPosition::new(-458, 260)));
    }

    /// 调整卡片高度时仅贴靠原生排位，用户移走再移回也不会恢复旧锚点。
    #[test]
    fn moving_the_mini_card_releases_its_tray_anchor() {
        let anchor = PhysicalPosition::new(850.0, 980.0);
        let placed = PhysicalPosition::new(564, 760);
        let mut state = CardState {
            tray_anchor: Some((anchor, placed)),
            ..Default::default()
        };
        assert_eq!(state.anchored_at(placed), Some(anchor));
        assert_eq!(state.anchored_at(PhysicalPosition::new(250, 450)), None);
        assert_eq!(state.anchored_at(placed), None);
    }
}
