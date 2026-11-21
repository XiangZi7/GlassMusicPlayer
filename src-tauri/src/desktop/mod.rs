//! 桌面能力：独立窗口的创建、恢复与应用退出行为。

pub(crate) mod appearance;
pub(crate) mod settings;
#[cfg(target_os = "windows")]
pub(crate) mod shadow_hit_test;
pub(crate) mod tray;
pub(crate) mod tray_menu;
pub(crate) mod windows;
