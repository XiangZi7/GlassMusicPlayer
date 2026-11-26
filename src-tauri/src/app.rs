use crate::desktop::{appearance, settings, tray, tray_menu, windows};
use crate::storage;

// 组装应用插件、命令、托盘和窗口生命周期，业务实现留在各自模块。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    #[cfg(target_os = "windows")]
    crate::desktop::media_session::set_app_identity(&context.config().identifier);
    context.set_default_window_icon(Some(tauri::include_image!("./icons/128x128.png")));
    tauri::Builder::default()
        .manage(tray::TrayPreferences::default())
        .manage(tray_menu::TrayMenuState::default())
        .manage(storage::StorageState::default())
        .manage(crate::tuneweave::Accounts::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            crate::tuneweave::tuneweave_begin_login,
            crate::tuneweave_catalog::tuneweave_kugou_search_hash,
            crate::tuneweave::tuneweave_finish_login,
            crate::tuneweave::tuneweave_cancel_login,
            crate::tuneweave::tuneweave_logout,
            crate::tuneweave::tuneweave_account,
            crate::tuneweave::tuneweave_favorites,
            crate::tuneweave::tuneweave_kugou_track_hash,
            crate::tuneweave::tuneweave_set_favorite,
            crate::updater::updater_check_source,
            crate::updater::updater_can_install,
            crate::updater::updater_restart,
            crate::playback_credential::read_playback_credential,
            crate::playback_credential::write_playback_credential,
            windows::open_desktop_window,
            windows::resize_desktop_surface,
            windows::set_desktop_lock,
            windows::set_lyric_island,
            tray::set_tray_mini,
            tray::set_close_to_tray,
            tray_menu::start_tray_session,
            tray_menu::resize_tray_menu,
            tray_menu::dismiss_tray_menu,
            tray_menu::run_tray_action,
            settings::open_settings_window,
            #[cfg(target_os = "windows")]
            crate::desktop::media_session::update_system_media_session,
            crate::desktop::location::reset_location_permission,
            storage::get_storage_info,
            storage::update_storage_config,
            storage::choose_storage_directory,
            storage::open_storage_directory,
            storage::clear_audio_cache,
            storage::list_downloads,
            storage::download_catalog_track
        ])
        .setup(|app| {
            let _main_window = appearance::create_main_window(app.handle())?;
            #[cfg(target_os = "windows")]
            crate::desktop::media_session::install(&_main_window);
            #[cfg(desktop)]
            tray::create(app)?;
            Ok(())
        })
        .on_window_event(windows::handle_window_event)
        .run(context)
        .expect("启动 MiraiPlayer 失败");
}
