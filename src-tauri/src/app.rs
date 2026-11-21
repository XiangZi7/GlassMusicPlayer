use crate::desktop::{appearance, settings, tray, tray_menu, windows};

// 组装应用插件、命令、托盘和窗口生命周期，业务实现留在各自模块。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(tray::TrayPreferences::default())
        .manage(tray_menu::TrayMenuState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            windows::open_desktop_window,
            windows::resize_desktop_surface,
            windows::set_desktop_lock,
            windows::set_lyric_island,
            tray::set_tray_mini,
            tray_menu::start_tray_session,
            tray_menu::resize_tray_menu,
            tray_menu::dismiss_tray_menu,
            tray_menu::run_tray_action,
            settings::open_settings_window
        ])
        .setup(|app| {
            appearance::create_main_window(app.handle())?;
            #[cfg(desktop)]
            tray::create(app)?;
            Ok(())
        })
        .on_window_event(windows::handle_window_event)
        .run(tauri::generate_context!())
        .expect("启动 Mirai Music 失败");
}
