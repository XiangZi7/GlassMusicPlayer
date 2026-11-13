use std::{cell::RefCell, ptr};
use tauri::{WebviewWindow, Window};
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
    Graphics::Gdi::ScreenToClient,
    System::LibraryLoader::GetModuleHandleW,
    UI::{
        HiDpi::GetDpiForWindow,
        Input::KeyboardAndMouse::GetCapture,
        WindowsAndMessaging::{
            CallNextHookEx, GWL_EXSTYLE, GetClientRect, GetCursorPos, GetWindowLongPtrW, HHOOK,
            IsChild, IsIconic, IsWindow, IsWindowVisible, IsZoomed, MSLLHOOKSTRUCT,
            SetWindowLongPtrW, SetWindowsHookExW, UnhookWindowsHookEx, WH_MOUSE_LL, WS_EX_LAYERED,
            WS_EX_TRANSPARENT,
        },
    },
};

/// 同一 UI 线程内需要透明外框穿透的窗口，不记录或转发鼠标事件。
struct FrameWindow {
    label: String,
    hwnd: HWND,
    inset: f64,
    layered: bool,
}

#[derive(Default)]
struct FrameHitTest {
    hook: HHOOK,
    windows: Vec<FrameWindow>,
}

thread_local! {
    static HIT_TEST: RefCell<FrameHitTest> = RefCell::new(FrameHitTest::default());
}

/// 判断圆角内的可交互区域；四边阴影和圆角外侧都不占用桌面输入。
fn contains_content(x: f64, y: f64, width: f64, height: f64, inset: f64, radius: f64) -> bool {
    let (x, y) = (x - inset, y - inset);
    let (width, height) = (width - inset * 2.0, height - inset * 2.0);
    if width <= 0.0 || height <= 0.0 || x < 0.0 || y < 0.0 || x >= width || y >= height {
        return false;
    }
    let radius = radius.min(width / 2.0).min(height / 2.0).max(0.0);
    let dx = x - x.clamp(radius, width - radius);
    let dy = y - y.clamp(radius, height - radius);
    dx * dx + dy * dy <= radius * radius
}

/// 在系统选择点击目标前同步切换窗口样式，避免前端轮询或离开事件造成点击延迟。
fn update_hit_test(window: &FrameWindow, mut point: POINT) {
    // 安全：句柄只在 UI 线程注册/移除，每次使用前检查其有效性。
    unsafe {
        if IsWindow(window.hwnd) == 0 {
            return;
        }
        let capture = GetCapture();
        let dragging =
            !capture.is_null() && (capture == window.hwnd || IsChild(window.hwnd, capture) != 0);
        let ignore = if dragging
            || IsZoomed(window.hwnd) != 0
            || IsIconic(window.hwnd) != 0
            || IsWindowVisible(window.hwnd) == 0
        {
            false
        } else {
            let mut rect = RECT::default();
            if GetClientRect(window.hwnd, &mut rect) == 0
                || ScreenToClient(window.hwnd, &mut point) == 0
            {
                return;
            }
            let scale = GetDpiForWindow(window.hwnd).max(96) as f64 / 96.0;
            !contains_content(
                point.x as f64,
                point.y as f64,
                rect.right as f64,
                rect.bottom as f64,
                window.inset * scale,
                8.0 * scale,
            )
        };
        let current = GetWindowLongPtrW(window.hwnd, GWL_EXSTYLE);
        let next = if ignore {
            current | WS_EX_LAYERED as isize | WS_EX_TRANSPARENT as isize
        } else if window.layered {
            current & !(WS_EX_TRANSPARENT as isize)
        } else {
            current & !(WS_EX_TRANSPARENT as isize | WS_EX_LAYERED as isize)
        };
        if current != next {
            SetWindowLongPtrW(window.hwnd, GWL_EXSTYLE, next);
        }
    }
}

/// 仅做本窗口几何命中计算，所有输入继续进入系统原有消息链。
unsafe extern "system" fn mouse_hook(code: i32, message: WPARAM, data: LPARAM) -> LRESULT {
    if code >= 0 && data != 0 {
        // 安全：WH_MOUSE_LL 在回调期间提供有效的 MSLLHOOKSTRUCT。
        let point = unsafe { (*(data as *const MSLLHOOKSTRUCT)).pt };
        HIT_TEST.with(|state| {
            if let Ok(state) = state.try_borrow() {
                for window in &state.windows {
                    update_hit_test(window, point);
                }
            }
        });
    }
    // 安全：不截断或重放输入，始终交回系统钩子链。
    unsafe { CallNextHookEx(ptr::null_mut(), code, message, data) }
}

/// 主窗口在 UI 线程安装一次原生命中处理，窗口透明期间仍能收到鼠标位置变化。
pub(crate) fn install(
    window: &WebviewWindow,
    inset: f64,
) -> Result<(), Box<dyn std::error::Error>> {
    let hwnd = window.hwnd()?.0 as HWND;
    HIT_TEST.with(|state| -> Result<(), std::io::Error> {
        let mut state = state.borrow_mut();
        if state.hook.is_null() {
            // 安全：回调和消息循环同属 UI 线程，不跨线程访问窗口状态。
            state.hook = unsafe {
                SetWindowsHookExW(
                    WH_MOUSE_LL,
                    Some(mouse_hook),
                    GetModuleHandleW(ptr::null()),
                    0,
                )
            };
            if state.hook.is_null() {
                return Err(std::io::Error::last_os_error());
            }
        }
        state.windows.push(FrameWindow {
            label: window.label().into(),
            hwnd,
            inset,
            // 安全：窗口刚创建且句柄有效，保留其原有的透明渲染模式。
            layered: unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) } & WS_EX_LAYERED as isize != 0,
        });
        let mut point = POINT::default();
        // 安全：栈上坐标有效；启动时立即校准，不等待第一次鼠标移动。
        if unsafe { GetCursorPos(&mut point) } != 0 {
            update_hit_test(state.windows.last().expect("已注册窗口"), point);
        }
        Ok(())
    })?;
    Ok(())
}

/// 新弹窗通过主线程注册，与主窗口共用同一个消息钩子。
pub(crate) fn add_window(window: &WebviewWindow, inset: f64) -> tauri::Result<()> {
    let label = window.label().to_owned();
    let handle = window.hwnd()?.0 as usize;
    window.run_on_main_thread(move || {
        HIT_TEST.with(|state| {
            state.borrow_mut().windows.push(FrameWindow {
                label,
                hwnd: handle as HWND,
                inset,
                // 安全：注册任务由所属 UI 线程执行，创建后的窗口句柄有效。
                layered: unsafe { GetWindowLongPtrW(handle as HWND, GWL_EXSTYLE) }
                    & WS_EX_LAYERED as isize
                    != 0,
            });
        });
        refresh();
    })
}

/// 窗口出现、移动或缩放后校准静止鼠标的位置，首个点击也按新边界处理。
pub(crate) fn refresh() {
    let mut point = POINT::default();
    // 安全：坐标由当前 UI 线程在栈上持有。
    if unsafe { GetCursorPos(&mut point) } == 0 {
        return;
    }
    HIT_TEST.with(|state| {
        if let Ok(state) = state.try_borrow() {
            for window in &state.windows {
                update_hit_test(window, point);
            }
        }
    });
}

/// 窗口销毁后释放对应状态；最后一个窗口退出时卸载原生钩子。
pub(crate) fn remove_window(window: &Window) {
    HIT_TEST.with(|state| {
        if let Ok(mut state) = state.try_borrow_mut() {
            state
                .windows
                .retain(|target| target.label != window.label());
            if state.windows.is_empty() && !state.hook.is_null() {
                // 安全：这里只移除本 UI 线程安装的钩子。
                unsafe { UnhookWindowsHookEx(state.hook) };
                state.hook = ptr::null_mut();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{FrameWindow, contains_content, update_hit_test};
    use windows_sys::Win32::{
        Foundation::POINT,
        Graphics::Gdi::ClientToScreen,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, GWL_EXSTYLE, GetWindowLongPtrW, WS_EX_LAYERED,
            WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT, WS_POPUP, WS_VISIBLE,
        },
    };

    /// 四边透明阴影都必须穿透，中间内容及可见缩放边缘正常接收输入。
    #[test]
    fn shadow_edges_pass_through() {
        for (x, y) in [(12.0, 400.0), (988.0, 400.0), (500.0, 12.0), (500.0, 788.0)] {
            assert!(!contains_content(x, y, 1000.0, 800.0, 24.0, 8.0));
        }
        assert!(contains_content(500.0, 25.0, 1000.0, 800.0, 24.0, 8.0));
        assert!(contains_content(25.0, 400.0, 1000.0, 800.0, 24.0, 8.0));
        assert!(contains_content(500.0, 400.0, 1000.0, 800.0, 24.0, 8.0));
    }

    /// 圆角外侧穿透，DPI 放大后仍按实际物理边界计算。
    #[test]
    fn rounded_corners_and_scaled_edges() {
        assert!(!contains_content(24.0, 24.0, 1000.0, 800.0, 24.0, 8.0));
        assert!(contains_content(32.0, 25.0, 1000.0, 800.0, 24.0, 8.0));
        assert!(!contains_content(47.0, 400.0, 2000.0, 1600.0, 48.0, 16.0));
        assert!(contains_content(49.0, 400.0, 2000.0, 1600.0, 48.0, 16.0));
    }

    /// 用屏幕外的独立测试窗口验证真实系统样式，内容区必须能从穿透状态恢复。
    #[test]
    fn native_style_restores_interaction_after_leaving_shadow() {
        struct TestWindow(windows_sys::Win32::Foundation::HWND);
        impl Drop for TestWindow {
            fn drop(&mut self) {
                // 安全：测试窗口只在当前测试线程创建、销毁。
                unsafe { DestroyWindow(self.0) };
            }
        }
        // 安全：使用系统内置窗口类，窗口放在屏幕外且不激活，不影响用户正在操作的窗口。
        let window = TestWindow(unsafe {
            CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                windows_sys::core::w!("STATIC"),
                windows_sys::core::w!("frame-hit-test"),
                WS_POPUP | WS_VISIBLE,
                -32000,
                -32000,
                1000,
                800,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
            )
        });
        assert!(!window.0.is_null());
        let target = FrameWindow {
            label: "test".into(),
            hwnd: window.0,
            inset: 24.0,
            layered: false,
        };
        let mut shadow_point = POINT { x: 8, y: 400 };
        // 安全：测试坐标和句柄有效，只在当前测试线程访问。
        unsafe { ClientToScreen(window.0, &mut shadow_point) };
        update_hit_test(&target, shadow_point);
        // 安全：窗口仍由当前作用域持有。
        let outside = unsafe { GetWindowLongPtrW(window.0, GWL_EXSTYLE) };
        assert_ne!(outside & WS_EX_TRANSPARENT as isize, 0);
        assert_ne!(outside & WS_EX_LAYERED as isize, 0);
        let mut content_point = POINT { x: 500, y: 400 };
        // 安全：转换当前测试窗口内部的坐标。
        unsafe { ClientToScreen(window.0, &mut content_point) };
        update_hit_test(&target, content_point);
        // 安全：窗口在测试结束后才由 Drop 销毁。
        let inside = unsafe { GetWindowLongPtrW(window.0, GWL_EXSTYLE) };
        assert_eq!(inside & WS_EX_TRANSPARENT as isize, 0);
        assert_eq!(inside & WS_EX_LAYERED as isize, 0);
        assert_ne!(inside & WS_EX_TOOLWINDOW as isize, 0);
    }
}
