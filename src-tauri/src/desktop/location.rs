/// 用户点击重新授权时，仅将当前主窗口来源的定位权限恢复为询问。
#[tauri::command]
pub(crate) async fn reset_location_permission(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("请在播放器主窗口重新授权定位".into());
    }
    #[cfg(target_os = "windows")]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PERMISSION_KIND_GEOLOCATION, COREWEBVIEW2_PERMISSION_STATE_DEFAULT,
            ICoreWebView2_13, ICoreWebView2Profile4,
        };
        use webview2_com::SetPermissionStateCompletedHandler;
        use windows_core::{HSTRING, Interface};

        let origin = window
            .url()
            .map_err(|e| e.to_string())?
            .origin()
            .ascii_serialization();
        let (sender, receiver) = tokio::sync::oneshot::channel();
        window
            .with_webview(move |view| {
                // controller 和 Profile 都只在 WebView 的 UI 线程调用。
                unsafe {
                    let profile = view
                        .controller()
                        .CoreWebView2()
                        .and_then(|core| core.cast::<ICoreWebView2_13>())
                        .and_then(|core| core.Profile())
                        .and_then(|profile| profile.cast::<ICoreWebView2Profile4>());
                    if let Ok(profile) = profile {
                        let callback =
                            SetPermissionStateCompletedHandler::create(Box::new(move |result| {
                                let _ = sender.send(result.is_ok());
                                Ok(())
                            }));
                        let _ = profile.SetPermissionState(
                            COREWEBVIEW2_PERMISSION_KIND_GEOLOCATION,
                            &HSTRING::from(origin),
                            COREWEBVIEW2_PERMISSION_STATE_DEFAULT,
                            &callback,
                        );
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        if !matches!(
            tokio::time::timeout(std::time::Duration::from_secs(3), receiver).await,
            Ok(Ok(true))
        ) {
            return Err("请检查系统位置设置后重试".into());
        }
    }
    Ok(())
}
