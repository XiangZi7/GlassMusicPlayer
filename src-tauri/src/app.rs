use crate::desktop::{appearance, settings, windows};

// 组装应用插件、命令和窗口生命周期，业务实现留在各自模块。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            windows::open_desktop_window,
            windows::set_lyric_island,
            settings::open_settings_window
        ])
        .setup(|app| appearance::create_main_window(app.handle()))
        .on_window_event(windows::handle_window_event)
        .run(tauri::generate_context!())
        .expect("启动 Mirai Music 失败");
}
