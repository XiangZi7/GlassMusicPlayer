//! 将主播放器的真实音频状态发布给 Windows 快速设置和媒体键。

use serde::Deserialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use windows::{
    Foundation::{TimeSpan, TypedEventHandler, Uri},
    Media::{
        MediaPlaybackStatus, MediaPlaybackType, PlaybackPositionChangeRequestedEventArgs,
        SystemMediaTransportControls, SystemMediaTransportControlsButton,
        SystemMediaTransportControlsButtonPressedEventArgs,
        SystemMediaTransportControlsTimelineProperties,
    },
    Storage::Streams::RandomAccessStreamReference,
    Win32::{
        Storage::EnhancedStorage::PKEY_AppUserModel_ID,
        System::{
            Com::StructuredStorage::PROPVARIANT, WinRT::ISystemMediaTransportControlsInterop,
        },
        UI::Shell::{
            PropertiesSystem::{IPropertyStore, SHGetPropertyStoreForWindow},
            SetCurrentProcessExplicitAppUserModelID,
        },
    },
    core::{HSTRING, PCWSTR, factory},
};

#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Playback {
    track: Track,
    playing: bool,
    can_next: bool,
    can_previous: bool,
    position: f64,
    duration: f64,
}

#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Track {
    id: String,
    title: String,
    artist: String,
    album: String,
    cover_url: Option<String>,
}

struct MediaSession {
    controls: SystemMediaTransportControls,
    button_token: i64,
    position_token: Option<i64>,
    playback: Option<Playback>,
}

/// 让 Windows 用与 NSIS 开始菜单快捷方式相同的应用标识查找播放器名称和图标。
pub(crate) fn set_app_identity(identifier: &str) {
    let id = HSTRING::from(identifier);
    // 此处仍在启动阶段，尚未创建窗口或媒体会话。
    if let Err(error) = unsafe { SetCurrentProcessExplicitAppUserModelID(PCWSTR(id.as_ptr())) } {
        eprintln!("注册 Windows 应用标识失败：{error}");
    }
}

/// 在主窗口创建后注册媒体会话，系统服务不可用时仍允许播放器启动。
pub(crate) fn install(window: &WebviewWindow) {
    match MediaSession::new(window) {
        Ok(session) => {
            window.manage(Mutex::new(Some(session)));
        }
        Err(error) => eprintln!("注册 Windows 媒体会话失败：{error}"),
    }
}

/// 主窗口真正销毁时停用系统会话，收起到托盘时保留后台控制。
pub(crate) fn release(app: &AppHandle) {
    if let Some(state) = app.try_state::<Mutex<Option<MediaSession>>>()
        && let Ok(mut session) = state.lock()
    {
        session.take();
    }
}

/// 只接收主窗口同步的播放状态，空状态撤下媒体卡片。
#[tauri::command]
pub(crate) fn update_system_media_session(
    window: WebviewWindow,
    playback: Option<Playback>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("只有主播放器可以更新系统媒体会话".into());
    }
    let state = window
        .try_state::<Mutex<Option<MediaSession>>>()
        .ok_or("Windows 媒体会话不可用")?;
    let mut session = state.lock().map_err(|_| "Windows 媒体会话不可用")?;
    session
        .as_mut()
        .ok_or("Windows 媒体会话已关闭")?
        .update(playback)
        .map_err(|error| error.to_string())
}

impl MediaSession {
    /// 用主窗口的 HWND 取得原生会话，并将 Windows 的按钮和进度请求转回主播放器。
    fn new(window: &WebviewWindow) -> Result<Self, Box<dyn std::error::Error>> {
        let hwnd = window.hwnd()?;
        let identifier = PROPVARIANT::from(window.config().identifier.as_str());
        // 窗口属性与进程和开始菜单使用同一标识，供通过 HWND 查询的系统媒体组件识别。
        let identity_result = unsafe {
            SHGetPropertyStoreForWindow::<IPropertyStore>(hwnd)
                .and_then(|store| store.SetValue(&PKEY_AppUserModel_ID, &identifier))
        };
        if let Err(error) = identity_result {
            eprintln!("设置主窗口的 Windows 应用标识失败：{error}");
        }
        let interop =
            factory::<SystemMediaTransportControls, ISystemMediaTransportControlsInterop>()?;
        // hwnd 来自本进程的 Tauri 顶层窗口，调用时窗口仍有效。
        let controls: SystemMediaTransportControls = unsafe { interop.GetForWindow(hwnd)? };
        controls.SetIsEnabled(false)?;
        controls.SetIsPlayEnabled(true)?;
        controls.SetIsPauseEnabled(true)?;

        let app = window.app_handle().clone();
        let button_token = controls.ButtonPressed(&TypedEventHandler::<
            SystemMediaTransportControls,
            SystemMediaTransportControlsButtonPressedEventArgs,
        >::new(move |_, args| {
            use SystemMediaTransportControlsButton as Button;
            let Some(args) = args.as_ref() else {
                return Ok(());
            };
            let action = match args.Button()? {
                Button::Play => "play",
                Button::Pause => "pause",
                Button::Next => "next",
                Button::Previous => "previous",
                _ => return Ok(()),
            };
            let _ = app.emit_to(
                "main",
                "player-action",
                serde_json::json!({ "type": action }),
            );
            Ok(())
        }))?;

        let app = window.app_handle().clone();
        let position_handler = TypedEventHandler::<
            SystemMediaTransportControls,
            PlaybackPositionChangeRequestedEventArgs,
        >::new(move |sender, args| {
            if let (Some(sender), Some(args)) = (sender.as_ref(), args.as_ref()) {
                let track_id = sender.DisplayUpdater()?.AppMediaId()?.to_string_lossy();
                let position = args.RequestedPlaybackPosition()?.Duration as f64 / 10_000_000.0;
                let _ = app.emit_to(
                    "main",
                    "player-action",
                    serde_json::json!({ "type": "seek-to", "value": position, "trackId": track_id }),
                );
            }
            Ok(())
        });
        let position_token = controls
            .PlaybackPositionChangeRequested(&position_handler)
            .ok();

        Ok(Self {
            controls,
            button_token,
            position_token,
            playback: None,
        })
    }

    /// 切歌时替换媒体属性，进度变化仅更新时间轴，停用时清掉上一次的曲目信息。
    fn update(&mut self, playback: Option<Playback>) -> windows::core::Result<()> {
        let previous = self.playback.as_ref();
        let Some(current) = playback.as_ref() else {
            self.controls.SetIsEnabled(false)?;
            self.controls
                .SetPlaybackStatus(MediaPlaybackStatus::Stopped)?;
            let display = self.controls.DisplayUpdater()?;
            display.ClearAll()?;
            display.Update()?;
            self.playback = None;
            return Ok(());
        };

        if previous.is_none_or(|last| last.track != current.track) {
            let display = self.controls.DisplayUpdater()?;
            display.ClearAll()?;
            display.SetType(MediaPlaybackType::Music)?;
            display.SetAppMediaId(&HSTRING::from(&current.track.id))?;
            let music = display.MusicProperties()?;
            music.SetTitle(&HSTRING::from(&current.track.title))?;
            music.SetArtist(&HSTRING::from(&current.track.artist))?;
            music.SetAlbumTitle(&HSTRING::from(&current.track.album))?;
            if let Some(url) = current.track.cover_url.as_deref()
                && (url.starts_with("https://") || url.starts_with("http://"))
                && let Ok(uri) = Uri::CreateUri(&HSTRING::from(url))
                && let Ok(cover) = RandomAccessStreamReference::CreateFromUri(&uri)
            {
                // 上游封面不可读时，仍发布文字和播放控制。
                let _ = display.SetThumbnail(&cover);
            }
            display.Update()?;
        }
        if previous.is_none_or(|last| last.can_next != current.can_next) {
            self.controls.SetIsNextEnabled(current.can_next)?;
        }
        if previous.is_none_or(|last| last.can_previous != current.can_previous) {
            self.controls.SetIsPreviousEnabled(current.can_previous)?;
        }
        if previous.is_none_or(|last| last.playing != current.playing) {
            self.controls.SetPlaybackStatus(if current.playing {
                MediaPlaybackStatus::Playing
            } else {
                MediaPlaybackStatus::Paused
            })?;
        }
        if self.position_token.is_some() {
            let timeline = SystemMediaTransportControlsTimelineProperties::new()?;
            let end = (current.duration.max(0.0) * 10_000_000.0) as i64;
            let position = (current.position.max(0.0) * 10_000_000.0) as i64;
            timeline.SetEndTime(TimeSpan { Duration: end })?;
            timeline.SetMaxSeekTime(TimeSpan { Duration: end })?;
            timeline.SetPosition(TimeSpan {
                Duration: position.min(end),
            })?;
            self.controls.UpdateTimelineProperties(&timeline)?;
        }
        if previous.is_none() {
            self.controls.SetIsEnabled(true)?;
        }
        self.playback = playback;
        Ok(())
    }
}

impl Drop for MediaSession {
    /// 解除系统回调和可见会话，避免已退出的主窗口继续占用媒体控制。
    fn drop(&mut self) {
        let _ = self.controls.SetIsEnabled(false);
        let _ = self.controls.RemoveButtonPressed(self.button_token);
        if let Some(token) = self.position_token {
            let _ = self.controls.RemovePlaybackPositionChangeRequested(token);
        }
    }
}
