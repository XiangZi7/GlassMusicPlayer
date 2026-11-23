use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackCredential {
    user_id: String,
    token: String,
}

// 限定为主窗口和当前音乐服务，防止不同服务共用设备授权。
fn credential_target(window: &tauri::WebviewWindow, server: &str) -> Result<String, String> {
    if window.label() != "main" || server.len() > 512 || server.chars().any(char::is_control) {
        return Err("无法访问网易云播放授权".into());
    }
    Ok(format!("com.admin.miraimusic/netease/{server}"))
}

// 启动时只读取本应用的设备授权，普通应用设置中不包含凭证。
#[tauri::command]
pub fn read_playback_credential(
    window: tauri::WebviewWindow,
    server: String,
) -> Result<Option<PlaybackCredential>, String> {
    let target = credential_target(&window, &server)?;
    #[cfg(windows)]
    return vault::read(&target);
    #[cfg(not(windows))]
    {
        let _ = target;
        Ok(None)
    }
}

// 扫码后原子替换系统凭据，解除关联时删除对应服务的记录。
#[tauri::command]
pub fn write_playback_credential(
    window: tauri::WebviewWindow,
    server: String,
    credential: Option<PlaybackCredential>,
) -> Result<(), String> {
    let target = credential_target(&window, &server)?;
    #[cfg(windows)]
    return vault::write(&target, credential.as_ref());
    #[cfg(not(windows))]
    {
        let _ = (target, credential);
        Err("当前系统不支持保存桌面播放授权".into())
    }
}

#[cfg(windows)]
mod vault {
    use super::PlaybackCredential;
    use windows_sys::Win32::{
        Foundation::{ERROR_NOT_FOUND, GetLastError},
        Security::Credentials::{
            CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC, CREDENTIALW, CredDeleteW, CredFree,
            CredReadW, CredWriteW,
        },
    };

    // 复制凭据内容后立即归还 Windows 分配的缓冲区，不输出原始数据。
    pub(super) fn read(target: &str) -> Result<Option<PlaybackCredential>, String> {
        let target: Vec<u16> = target.encode_utf16().chain([0]).collect();
        let mut ptr = std::ptr::null_mut();
        unsafe {
            if CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut ptr) == 0 {
                return if GetLastError() == ERROR_NOT_FOUND {
                    Ok(None)
                } else {
                    Err("读取 Windows 凭据管理器失败".into())
                };
            }
            let item = &*ptr;
            let result = if item.CredentialBlob.is_null() || item.CredentialBlobSize > 2560 {
                Err("保存的播放授权无效".into())
            } else {
                serde_json::from_slice(std::slice::from_raw_parts(
                    item.CredentialBlob,
                    item.CredentialBlobSize as usize,
                ))
                .map(Some)
                .map_err(|_| "保存的播放授权无效".into())
            };
            CredFree(ptr.cast());
            result
        }
    }

    // 凭据由当前 Windows 用户保管，只在本机保存。
    pub(super) fn write(
        target: &str,
        credential: Option<&PlaybackCredential>,
    ) -> Result<(), String> {
        let mut target: Vec<u16> = target.encode_utf16().chain([0]).collect();
        let Some(credential) = credential else {
            return unsafe {
                if CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) != 0
                    || GetLastError() == ERROR_NOT_FOUND
                {
                    Ok(())
                } else {
                    Err("移除 Windows 播放凭据失败".into())
                }
            };
        };
        if credential.user_id.is_empty()
            || credential.user_id.len() > 20
            || !credential.user_id.bytes().all(|c| c.is_ascii_digit())
            || credential.token.len() != 43
            || !credential
                .token
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
        {
            return Err("播放授权格式无效".into());
        }
        let mut blob = serde_json::to_vec(credential).map_err(|_| "播放授权格式无效")?;
        let item = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: target.as_mut_ptr(),
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            ..Default::default()
        };
        if unsafe { CredWriteW(&item, 0) } == 0 {
            return Err("保存 Windows 播放凭据失败".into());
        }
        Ok(())
    }

    #[test]
    // 实际走系统凭据库，只操作这次测试独占的随机命名记录。
    fn windows_vault_round_trip() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let target = format!("com.admin.miraimusic/test/{}-{nonce}", std::process::id());
        assert!(read(&target).unwrap().is_none());
        let saved = PlaybackCredential {
            user_id: "123".into(),
            token: "a".repeat(43),
        };
        write(&target, Some(&saved)).unwrap();
        let loaded = read(&target);
        write(&target, None).unwrap();
        assert_eq!(loaded.unwrap().unwrap().user_id, saved.user_id);
        assert!(read(&target).unwrap().is_none());
    }
}
