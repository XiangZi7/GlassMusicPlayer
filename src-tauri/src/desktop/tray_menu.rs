//! 自定义托盘菜单：缓存透明 WebView、最小 IPC、工作区定位和原生菜单回退。

use super::{tray, windows::SURFACE_INSET};
use serde::Deserialize;
use std::sync::{
    Mutex,
    atomic::{AtomicBool, AtomicU64, Ordering},
};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalRect, PhysicalSize, Rect,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent, Wry, menu::Menu,
    utils::config::Color, webview::PageLoadEvent,
};

pub(crate) const TRAY_LABEL: &str = "tray";
const TRAY_ICON_ID: &str = "mirai-player-tray";
const CONTENT_WIDTH: f64 = 288.0;
const INITIAL_HEIGHT: f64 = 440.0;

pub(crate) struct TrayMenuState {
    ready: AtomicBool,
    shown: AtomicBool,
    wanted: AtomicBool,
    generation: AtomicU64,
    opening: AtomicU64,
    acting: AtomicBool,
    // 只在后台命令/纠偏任务中取得；UI 回调永不等待此锁。
    placement: Mutex<()>,
    height: Mutex<f64>,
    anchor: Mutex<Option<PhysicalPosition<f64>>>,
    fallback: Mutex<Option<Menu<Wry>>>,
}
impl Default for TrayMenuState {
    fn default() -> Self {
        Self {
            ready: AtomicBool::new(false),
            shown: AtomicBool::new(false),
            wanted: AtomicBool::new(false),
            generation: AtomicU64::new(0),
            opening: AtomicU64::new(0),
            acting: AtomicBool::new(false),
            placement: Mutex::new(()),
            height: Mutex::new(INITIAL_HEIGHT),
            anchor: Mutex::new(None),
            fallback: Mutex::new(None),
        }
    }
}
struct AtomicGuard<'a>(&'a AtomicBool);
impl<'a> AtomicGuard<'a> {
    fn acquire(flag: &'a AtomicBool) -> Option<Self> {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .ok()
            .map(|_| Self(flag))
    }
}
impl Drop for AtomicGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

/// 页面代号和开合代号相互独立，正常收起不会使缓存 Vue 的尺寸 session 失效。
#[derive(Clone, Copy)]
pub(crate) struct OpenRequest {
    generation: u64,
    opening: u64,
}
fn new_request(state: &TrayMenuState) -> OpenRequest {
    state.wanted.store(true, Ordering::Release);
    OpenRequest {
        generation: state.generation.load(Ordering::Acquire),
        opening: state.opening.fetch_add(1, Ordering::AcqRel) + 1,
    }
}
fn valid_request(state: &TrayMenuState, request: OpenRequest) -> bool {
    state.ready.load(Ordering::Acquire)
        && state.wanted.load(Ordering::Acquire)
        && state.generation.load(Ordering::Acquire) == request.generation
        && state.opening.load(Ordering::Acquire) == request.opening
}
fn invalidate_visibility(state: &TrayMenuState) -> bool {
    state.opening.fetch_add(1, Ordering::AcqRel);
    state.wanted.store(false, Ordering::Release);
    state.shown.swap(false, Ordering::AcqRel)
}

#[derive(Clone, Copy, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum TrayAction {
    Main,
    Mini,
    Lyrics,
    Media,
    Settings,
    Exit,
    Toggle,
}
fn ensure_tray(label: &str) -> Result<(), String> {
    if label == TRAY_LABEL {
        Ok(())
    } else {
        Err("此操作只允许托盘菜单窗口调用".into())
    }
}
fn ensure_generation(current: u64, requested: u64) -> Result<(), String> {
    if current == requested {
        Ok(())
    } else {
        Err("托盘页面已更新，旧请求已取消".into())
    }
}
fn valid_height(height: f64) -> bool {
    height.is_finite() && (220.0..=640.0).contains(&height)
}

/// 将状态、原生 show/hide/menu 和事件通知放到同一 UI 执行序列。
/// 不持有 placement 锁跨越此 await，也不阻塞 UI 线程等待后台任务。
async fn on_ui_thread<T, F>(app: &AppHandle, task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&AppHandle) -> Result<T, String> + Send + 'static,
{
    let (sender, receiver) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = sender.send(task(&handle));
    })
    .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv()
            .unwrap_or_else(|_| Err("托盘 UI 任务已取消".into()))
    })
    .await
    .map_err(|error| error.to_string())?
}

pub(crate) fn is_ready(app: &AppHandle) -> bool {
    app.state::<TrayMenuState>().ready.load(Ordering::Acquire)
}
pub(crate) fn remember_native_menu(app: &AppHandle, menu: &Menu<Wry>) -> Result<(), String> {
    *app.state::<TrayMenuState>()
        .fallback
        .lock()
        .map_err(|_| "托盘回退菜单不可用")? = Some(menu.clone());
    Ok(())
}

/// 仅在 setup 中预建；同步托盘事件中创建 WebView 会阻塞 Windows UI 线程。
#[cfg(target_os = "windows")]
pub(crate) fn create_window(app: &AppHandle) -> Result<(), String> {
    let window = WebviewWindowBuilder::new(
        app,
        TRAY_LABEL,
        WebviewUrl::App("index.html#/desktop/tray".into()),
    )
    .title("Mirai Music · 托盘菜单")
    .inner_size(
        CONTENT_WIDTH + SURFACE_INSET * 2.0,
        INITIAL_HEIGHT + SURFACE_INSET * 2.0,
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
    .on_page_load(|window, payload| {
        if matches!(payload.event(), PageLoadEvent::Started) {
            restore_native_menu(window.app_handle());
        }
    })
    .build()
    .map_err(|error| format!("创建托盘菜单失败：{error}"))?;
    super::shadow_hit_test::add_surface_window(&window, SURFACE_INSET, 18.0)
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// 仅在 UI 回调/事务中调用；每次重载或回退都作废旧页，无论 ready 是否已经为 false。
fn restore_native_menu(app: &AppHandle) {
    let state = app.state::<TrayMenuState>();
    state.generation.fetch_add(1, Ordering::AcqRel);
    if state.ready.swap(false, Ordering::AcqRel) {
        let menu = state.fallback.lock().ok().and_then(|menu| menu.clone());
        if let (Some(icon), Some(menu)) = (app.tray_by_id(TRAY_ICON_ID), menu) {
            if let Err(error) = icon.set_menu(Some(menu)) {
                eprintln!("恢复原生托盘菜单失败：{error}");
            }
        }
    }
    cancel_pending(app);
}
pub(crate) async fn restore_native_menu_async(app: &AppHandle) -> Result<(), String> {
    on_ui_thread(app, |app| {
        restore_native_menu(app);
        Ok(())
    })
    .await
}

/// 左键托盘和原生关闭也作废在途显示，即使窗口尚未真正 show。
/// 此函数只由 UI 事件或 on_ui_thread 调用。
pub(crate) fn cancel_pending(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(TRAY_LABEL) {
        let _ = hide_popup(&window);
    } else {
        invalidate_visibility(&app.state::<TrayMenuState>());
    }
}
fn hide_popup(window: &WebviewWindow) -> Result<(), String> {
    let app = window.app_handle();
    let was_shown = invalidate_visibility(&app.state::<TrayMenuState>());
    window.hide().map_err(|error| error.to_string())?;
    if was_shown {
        let _ = app.emit_to(TRAY_LABEL, "tray-closed", ());
    }
    Ok(())
}

fn constrained_size(height: f64, work: PhysicalSize<u32>, scale: f64) -> LogicalSize<f64> {
    LogicalSize::new(
        (CONTENT_WIDTH + SURFACE_INSET * 2.0).min((work.width as f64 / scale - 16.0).max(1.0)),
        (height.ceil() + SURFACE_INSET * 2.0).min((work.height as f64 / scale - 16.0).max(1.0)),
    )
}
fn popup_position(
    pointer: PhysicalPosition<f64>,
    size: PhysicalSize<u32>,
    area: PhysicalRect<i32, u32>,
    scale: f64,
) -> PhysicalPosition<i32> {
    let margin = 8.0 * scale;
    let min_x = area.position.x as f64 + margin;
    let min_y = area.position.y as f64 + margin;
    let max_x =
        (area.position.x as f64 + area.size.width as f64 - size.width as f64 - margin).max(min_x);
    let max_y =
        (area.position.y as f64 + area.size.height as f64 - size.height as f64 - margin).max(min_y);
    let above = pointer.y - size.height as f64 + SURFACE_INSET * scale - 12.0 * scale;
    let below = pointer.y - SURFACE_INSET * scale + 12.0 * scale;
    let above_space = pointer.y - area.position.y as f64;
    let below_space = area.position.y as f64 + area.size.height as f64 - pointer.y;
    let y = if above >= min_y || above_space >= below_space {
        above
    } else {
        below
    };
    PhysicalPosition::new(
        (pointer.x - size.width as f64 + SURFACE_INSET * scale + 12.0 * scale)
            .clamp(min_x, max_x)
            .round() as i32,
        y.clamp(min_y, max_y).round() as i32,
    )
}
fn contains(
    point: PhysicalPosition<f64>,
    origin: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> bool {
    point.x >= origin.x as f64
        && point.y >= origin.y as f64
        && point.x < origin.x as f64 + size.width as f64
        && point.y < origin.y as f64 + size.height as f64
}

fn place_popup(window: &WebviewWindow) -> Result<(), String> {
    update_popup(window, None)
}
/// 所有调用均在后台命令/事件 spawn 内；不丢弃竞争请求，按最新状态串行应用。
fn update_popup(window: &WebviewWindow, update: Option<(f64, u64)>) -> Result<(), String> {
    let app = window.app_handle();
    let state = app.state::<TrayMenuState>();
    let _placement = state.placement.lock().map_err(|_| "托盘定位状态不可用")?;
    if let Some((height, generation)) = update {
        ensure_generation(state.generation.load(Ordering::Acquire), generation)?;
        *state.height.lock().map_err(|_| "托盘尺寸状态不可用")? = height;
    }
    let pointer = *state.anchor.lock().map_err(|_| "托盘位置状态不可用")?;
    let monitor = window
        .available_monitors()
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|monitor| {
            pointer.is_some_and(|point| contains(point, *monitor.position(), *monitor.size()))
        })
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or("找不到托盘所在显示器")?;
    let area = *monitor.work_area();
    let scale = monitor.scale_factor();
    let height = *state.height.lock().map_err(|_| "托盘尺寸状态不可用")?;
    let desired = constrained_size(height, area.size, scale);
    let current_scale = window.scale_factor().map_err(|error| error.to_string())?;
    let actual = window.inner_size().map_err(|error| error.to_string())?;
    let changed = (actual.width as f64 - desired.width * current_scale).abs() > 1.0
        || (actual.height as f64 - desired.height * current_scale).abs() > 1.0;
    if changed {
        // 保留逻辑尺寸；跨屏由 WM_DPICHANGED 缩放，不能先应用目标屏的物理尺寸。
        window
            .set_size(desired)
            .map_err(|error| error.to_string())?;
    }
    let outer = window.outer_size().map_err(|error| error.to_string())?;
    let predicted = if changed {
        PhysicalSize::new(
            (desired.width * scale).round() as u32,
            (desired.height * scale).round() as u32,
        )
    } else {
        PhysicalSize::new(
            (outer.width as f64 / current_scale * scale).round() as u32,
            (outer.height as f64 / current_scale * scale).round() as u32,
        )
    };
    let pointer = pointer.unwrap_or(PhysicalPosition::new(
        area.position.x as f64 + area.size.width as f64 - 16.0 * scale,
        area.position.y as f64 + area.size.height as f64,
    ));
    let position = popup_position(pointer, predicted, area, scale);
    if window.outer_position().map_err(|error| error.to_string())? != position {
        window
            .set_position(position)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}
fn request_snapshot(app: &AppHandle) {
    let _ = app.emit_to("main", "player-ready", ());
    let _ = app.emit_to("main", "settings-ready", ());
}

/// 在原生右键 Up 回调内捕获开合代号，之后才排入 async 任务。
pub(crate) fn request_open(
    app: &AppHandle,
    pointer: PhysicalPosition<f64>,
    rect: Rect,
) -> Result<Option<OpenRequest>, String> {
    let state = app.state::<TrayMenuState>();
    if !state.ready.load(Ordering::Acquire) {
        return Ok(None);
    }
    if !pointer.x.is_finite() || !pointer.y.is_finite() {
        return Err("托盘位置无效".into());
    }
    let position = rect.position.to_physical::<i32>(1.0);
    let size = rect.size.to_physical::<u32>(1.0);
    let anchor = if size.width > 0 && size.height > 0 {
        PhysicalPosition::new(
            position.x as f64 + size.width as f64 / 2.0,
            position.y as f64 + size.height as f64 / 2.0,
        )
    } else {
        pointer
    };
    *state.anchor.lock().map_err(|_| "托盘位置状态不可用")? = Some(anchor);
    Ok(Some(new_request(&state)))
}

pub(crate) async fn show(app: &AppHandle, request: OpenRequest) -> Result<(), String> {
    if !valid_request(&app.state::<TrayMenuState>(), request) {
        return Ok(());
    }
    let window = app
        .get_webview_window(TRAY_LABEL)
        .ok_or("托盘菜单窗口不可用")?;
    place_popup(&window)?;
    // 定位可能等待 UI/DPI；取消、重载或较新的右键已经让旧请求失效。
    on_ui_thread(app, move |app| {
        let state = app.state::<TrayMenuState>();
        if !valid_request(&state, request) {
            return Ok(());
        }
        let window = app
            .get_webview_window(TRAY_LABEL)
            .ok_or("托盘菜单窗口不可用")?;
        state.shown.store(true, Ordering::Release);
        let result = (|| {
            window.show().map_err(|error| error.to_string())?;
            if !valid_request(&state, request) {
                return Ok(());
            }
            window.set_focus().map_err(|error| error.to_string())?;
            if !valid_request(&state, request) {
                return Ok(());
            }
            app.emit_to(
                TRAY_LABEL,
                "tray-opened",
                app.state::<tray::TrayPreferences>().enabled(),
            )
            .map_err(|error| error.to_string())?;
            request_snapshot(app);
            Ok(())
        })();
        if result.is_err() {
            let _ = hide_popup(&window);
        }
        result
    })
    .await
}

#[tauri::command]
pub(crate) async fn start_tray_session(window: WebviewWindow) -> Result<u64, String> {
    ensure_tray(window.label())?;
    on_ui_thread(window.app_handle(), |app| {
        Ok(app
            .state::<TrayMenuState>()
            .generation
            .load(Ordering::Acquire))
    })
    .await
}

/// 订阅/尺寸握手携带页面代号，旧页在途请求不能撤销新页的原生回退。
#[tauri::command]
pub(crate) async fn resize_tray_menu(
    window: WebviewWindow,
    content_height: f64,
    generation: u64,
) -> Result<(), String> {
    ensure_tray(window.label())?;
    if !valid_height(content_height) {
        return Err("托盘菜单高度无效".into());
    }
    update_popup(&window, Some((content_height, generation)))?;
    // placement 已释放；同一 UI 事务内核对代号、移除原生菜单并发布 ready。
    on_ui_thread(window.app_handle(), move |app| {
        let state = app.state::<TrayMenuState>();
        ensure_generation(state.generation.load(Ordering::Acquire), generation)?;
        if !state.ready.load(Ordering::Acquire) {
            let icon = app.tray_by_id(TRAY_ICON_ID).ok_or("系统托盘尚未就绪")?;
            icon.set_menu(None::<Menu<Wry>>)
                .map_err(|error| error.to_string())?;
            state.ready.store(true, Ordering::Release);
            request_snapshot(app);
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub(crate) async fn dismiss_tray_menu(
    window: WebviewWindow,
    generation: u64,
) -> Result<(), String> {
    ensure_tray(window.label())?;
    on_ui_thread(window.app_handle(), move |app| {
        ensure_generation(
            app.state::<TrayMenuState>()
                .generation
                .load(Ordering::Acquire),
            generation,
        )?;
        cancel_pending(app);
        Ok(())
    })
    .await
}

#[tauri::command]
pub(crate) async fn run_tray_action(
    window: WebviewWindow,
    action: TrayAction,
    generation: u64,
) -> Result<(), String> {
    ensure_tray(window.label())?;
    let app = window.app_handle();
    let state = app.state::<TrayMenuState>();
    ensure_generation(state.generation.load(Ordering::Acquire), generation)?;
    let _guard = AtomicGuard::acquire(&state.acting).ok_or("托盘操作正在处理中")?;
    let revision = on_ui_thread(app, move |app| {
        let state = app.state::<TrayMenuState>();
        ensure_generation(state.generation.load(Ordering::Acquire), generation)?;
        if !state.shown.load(Ordering::Acquire) {
            return Err("请先打开托盘菜单".into());
        }
        if action == TrayAction::Mini && !app.state::<tray::TrayPreferences>().enabled() {
            return Err("迷你播放器已在设置中关闭。".into());
        }
        if action == TrayAction::Toggle {
            app.emit_to(
                "main",
                "player-action",
                serde_json::json!({ "type": "toggle" }),
            )
            .map_err(|error| error.to_string())?;
            return Ok(None);
        }
        // 先在 UI 线程真正收起，再创建/聚焦目标，避免 menu/mini 互抢焦点。
        let popup = app
            .get_webview_window(TRAY_LABEL)
            .ok_or("托盘菜单窗口不可用")?;
        hide_popup(&popup)?;
        Ok(Some(state.opening.load(Ordering::Acquire)))
    })
    .await?;
    let Some(revision) = revision else {
        return Ok(());
    };
    let anchor = app.state::<tray::TrayPreferences>().anchor();
    let result = match action {
        TrayAction::Main => tray::focus_main(app),
        TrayAction::Mini => super::windows::show_desktop_window(
            app,
            super::windows::DesktopWindowKind::Mini,
            anchor,
        ),
        TrayAction::Lyrics => super::windows::show_desktop_window(
            app,
            super::windows::DesktopWindowKind::Lyrics,
            anchor,
        ),
        TrayAction::Media => super::windows::show_desktop_window(
            app,
            super::windows::DesktopWindowKind::Media,
            anchor,
        ),
        TrayAction::Settings => super::settings::open_settings_window(app.clone()).await,
        TrayAction::Exit => {
            app.exit(0);
            Ok(())
        }
        TrayAction::Toggle => unreachable!(),
    };
    if result.is_err() {
        // 若用户已收起/左键恢复/再次右键，不因旧操作失败重新抢回菜单焦点。
        let request = on_ui_thread(app, move |app| {
            let state = app.state::<TrayMenuState>();
            if state.ready.load(Ordering::Acquire)
                && state.generation.load(Ordering::Acquire) == generation
                && state.opening.load(Ordering::Acquire) == revision
            {
                Ok(Some(new_request(&state)))
            } else {
                Ok(None)
            }
        })
        .await;
        if let Ok(Some(request)) = request {
            let _ = show(app, request).await;
        }
    }
    result
}

pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != TRAY_LABEL {
        return;
    }
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
    }
    match event {
        WindowEvent::Focused(false) => {
            let state = window.app_handle().state::<TrayMenuState>();
            // 我们自己 hide 产生的失焦不再次取消下一次开合/错误恢复。
            if state.shown.load(Ordering::Acquire) || state.wanted.load(Ordering::Acquire) {
                cancel_pending(window.app_handle());
            }
        }
        WindowEvent::CloseRequested { .. } => cancel_pending(window.app_handle()),
        WindowEvent::Destroyed => restore_native_menu(window.app_handle()),
        WindowEvent::Resized(_)
        | WindowEvent::ScaleFactorChanged { .. }
        | WindowEvent::Moved(_)
        | WindowEvent::Focused(true) => {
            if window
                .app_handle()
                .state::<TrayMenuState>()
                .shown
                .load(Ordering::Acquire)
            {
                if let Some(popup) = window.app_handle().get_webview_window(TRAY_LABEL) {
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = place_popup(&popup) {
                            eprintln!("校准托盘菜单位置失败：{error}");
                        }
                    });
                }
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ipc_requires_the_real_tray_window_and_bounded_height() {
        assert!(ensure_tray("tray").is_ok());
        for label in ["main", "settings", "mini", "lyrics", "media", "island", ""] {
            assert!(ensure_tray(label).is_err());
        }
        for height in [220.0, 440.25, 640.0] {
            assert!(valid_height(height));
        }
        for height in [f64::NAN, f64::INFINITY, -1.0, 0.0, 219.9, 640.1] {
            assert!(!valid_height(height));
        }
    }
    #[test]
    fn stale_page_requests_are_rejected_without_rearming_ready() {
        let state = TrayMenuState::default();
        let old = state.generation.load(Ordering::Acquire);
        assert!(ensure_generation(old, old).is_ok());
        state.generation.fetch_add(1, Ordering::AcqRel);
        assert!(ensure_generation(state.generation.load(Ordering::Acquire), old).is_err());
        assert!(!state.ready.load(Ordering::Acquire));
    }
    #[test]
    fn close_reload_and_newer_open_invalidate_inflight_show() {
        let state = TrayMenuState::default();
        state.ready.store(true, Ordering::Release);
        let first = new_request(&state);
        assert!(valid_request(&state, first));
        invalidate_visibility(&state);
        assert!(!valid_request(&state, first));
        assert!(state.ready.load(Ordering::Acquire));
        let second = new_request(&state);
        let third = new_request(&state);
        assert!(!valid_request(&state, second));
        assert!(valid_request(&state, third));
        state.generation.fetch_add(1, Ordering::AcqRel);
        assert!(!valid_request(&state, third));
    }
    #[test]
    fn actions_are_a_closed_typed_whitelist() {
        for action in [
            "main", "mini", "lyrics", "media", "settings", "exit", "toggle",
        ] {
            assert!(serde_json::from_str::<TrayAction>(&format!("\"{action}\"")).is_ok());
        }
        for action in ["close-main", "open-url", "shell", "unknown"] {
            assert!(serde_json::from_str::<TrayAction>(&format!("\"{action}\"")).is_err());
        }
    }
    #[test]
    fn menu_and_shadow_stay_in_each_taskbar_work_area() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            for (x, y, width, height) in [
                (0, 0, 1920, 1040),
                (0, 48, 1920, 1032),
                (48, 0, 1872, 1080),
                (0, 0, 1872, 1080),
                (-1920, -1080, 1920, 1040),
            ] {
                let area = PhysicalRect {
                    position: PhysicalPosition::new(x, y),
                    size: PhysicalSize::new(width, height),
                };
                let logical = constrained_size(480.0, area.size, scale);
                let size = PhysicalSize::new(
                    (logical.width * scale).round() as u32,
                    (logical.height * scale).round() as u32,
                );
                for pointer in [
                    PhysicalPosition::new(x as f64 + 8.0, y as f64 + 8.0),
                    PhysicalPosition::new(
                        x as f64 + width as f64 - 8.0,
                        y as f64 + height as f64 + 24.0,
                    ),
                ] {
                    let position = popup_position(pointer, size, area, scale);
                    let margin = (8.0 * scale) as i32;
                    assert!(position.x >= x + margin && position.y >= y + margin);
                    assert!(position.x + size.width as i32 <= x + width as i32 - margin);
                    assert!(position.y + size.height as i32 <= y + height as i32 - margin);
                }
            }
        }
    }
    #[test]
    fn small_work_area_constrains_only_the_menu_viewport() {
        let size = constrained_size(600.0, PhysicalSize::new(320, 280), 1.0);
        assert_eq!(size.width, 304.0);
        assert_eq!(size.height, 264.0);
        assert_eq!(CONTENT_WIDTH, 288.0);
    }
    #[test]
    fn duplicate_actions_are_rejected_and_guards_release_on_drop() {
        let state = TrayMenuState::default();
        assert!(!state.ready.load(Ordering::Acquire));
        assert!(!state.shown.load(Ordering::Acquire));
        let guard = AtomicGuard::acquire(&state.acting).unwrap();
        assert!(AtomicGuard::acquire(&state.acting).is_none());
        drop(guard);
        assert!(AtomicGuard::acquire(&state.acting).is_some());
    }
}
