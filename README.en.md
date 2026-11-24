# MiraiPlayer

A desktop music player with synchronized lyrics, glass window styles and floating playback controls. Search tracks on NetEase Cloud Music, Kuwo and Kugou, or import a public playlist from a shared link.

[Releases](https://github.com/XiangZi7/GlassMusicPlayer/releases) · [Desktop builds](https://github.com/XiangZi7/GlassMusicPlayer/actions/workflows/release.yml) · [简体中文](README.md)

![MiraiPlayer home view with a daily selection, playlists and tracks](docs/images/home.png)

## Downloads

Open **Assets** on a release and choose the suffix for your machine.

| System | File suffix | How to run |
| --- | --- | --- |
| Windows x64 | `windows_x64_setup.exe` | Run the per-user installer. |
| Windows x64, portable | `windows_x64_portable.zip` | Extract and run `miraiplayer.exe`. Requires WebView2 Runtime. |
| macOS 13.3+, Apple Silicon | `macos_arm64.dmg` | Open the disk image and drag the app into Applications. |
| macOS 13.3+, Intel | `macos_x64.dmg` | Choose this image for Intel-based Macs. |
| Linux x64, Debian/Ubuntu | `linux_x64.deb` | Install with `sudo apt install ./filename.deb`. |
| Linux x64, standalone | `linux_x64.AppImage` | Run `chmod +x filename.AppImage`, then launch it. |

The Windows packages use the system WebView2 runtime. The macOS bundles use ad-hoc signing. Linux packages are built on Ubuntu 22.04. To verify a download, compare its SHA-256 digest with the corresponding entry in the release's `SHA256SUMS.txt`.

## Playback

- Search by title or artist, or paste a public playlist link into the platform connection panel. Playback availability and preview limits follow the source platform.
- Choose one of four fullscreen lyric layouts. Tracks with word timing fill in as they play. Other timed lyrics follow the current line.
- Open desktop lyrics or the mini player from the system tray. Imported playlists and preferences persist on the current device. Windows can keep a NetEase device playback credential in Credential Manager.

## Development

Install Node.js 22.22.2, pnpm 10.33.0, Rust 1.96.0 and the native build tools for your platform. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

Run `pnpm build` for frontend checks and a production web build. Run `pnpm tauri build -- --locked` for native packages. The default music service is `https://music-api.yxcr.top`. Set `VITE_APP_BASE_API` in `.env.local` to use another instance and restart or rebuild.

The [release guide](docs/RELEASING.md) covers GitHub builds and release drafts. The [development notes](docs/DEVELOPMENT.md) describe the app architecture and test commands. Both guides are in Chinese.
