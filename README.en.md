# 🎵 MiraiPlayer

A desktop music player blending minimalist design, frosted glass, Liquid Glass, and Pop Art, with support for NetEase Cloud Music, Kugou Music, and Kuwo Music.

<p align="center"><a href="#-download"><strong>Download desktop app ↓</strong></a> · <a href="#-features">Features</a> · <a href="#-local-development">Local development</a> · <a href="README.md">简体中文</a></p>

<p align="center">
  <a href="https://github.com/XiangZi7/MiraiPlayer/releases"><img src="docs/images/badges/releases.svg" alt="GitHub Releases" /></a>
  <a href="https://github.com/XiangZi7/MiraiPlayer/actions/workflows/release.yml?query=branch%3Amain"><img src="docs/images/badges/dev-downloads.svg" alt="Download development builds" /></a>
  <a href="https://github.com/XiangZi7/MiraiPlayer/actions/workflows/release.yml"><img src="https://github.com/XiangZi7/MiraiPlayer/actions/workflows/release.yml/badge.svg?branch=main" alt="Desktop build status" /></a>
  <a href="#-download"><img src="docs/images/badges/windows.svg" alt="Windows x64" /></a>
  <a href="#-download"><img src="docs/images/badges/macos.svg" alt="macOS Intel / Apple Silicon" /></a>
  <a href="#-download"><img src="docs/images/badges/linux.svg" alt="Linux x64" /></a>
</p>

<p align="center">
  <a href="docs/FRONTEND_ARCHITECTURE.md"><img src="docs/images/badges/tauri.svg" alt="Tauri 2" /></a>
  <a href="docs/FRONTEND_ARCHITECTURE.md"><img src="docs/images/badges/rust.svg" alt="Rust 2024" /></a>
  <a href="docs/FRONTEND_ARCHITECTURE.md"><img src="docs/images/badges/vue.svg" alt="Vue 3" /></a>
  <a href="docs/FRONTEND_ARCHITECTURE.md"><img src="docs/images/badges/typescript.svg" alt="TypeScript 6" /></a>
  <a href="docs/FRONTEND_ARCHITECTURE.md"><img src="docs/images/badges/vite.svg" alt="Vite 8" /></a>
  <a href="docs/FRONTEND_ARCHITECTURE.md"><img src="docs/images/badges/tailwind.svg" alt="Tailwind CSS 4" /></a>
</p>

## 📦 Download

| OS | Download v0.1.10 |
| --- | --- |
| **Windows** | [![Setup x64](docs/images/badges/windows-setup.svg)][windows-setup] [![Portable ZIP x64](docs/images/badges/windows-portable.svg)][windows-portable] |
| **macOS** | [![DMG Apple Silicon](docs/images/badges/macos-arm64.svg)][macos-arm64] [![DMG Intel x64](docs/images/badges/macos-x64.svg)][macos-x64] |
| **Linux** | [![AppImage x64](docs/images/badges/linux-appimage.svg)][linux-appimage] [![DEB x64](docs/images/badges/linux-deb.svg)][linux-deb] |

[Latest release][latest] · [Release history][releases] · [Development builds][dev-builds]

## ✨ Features

| Feature | What you can do |
| --- | --- |
| 🎵 [Online catalogs](docs/platforms.md) | Search NetEase Cloud Music, Kugou, and Kuwo, import public playlists, and browse your library |
| 🎧 [Playback and sound](docs/playback.md) | Manage the playback queue, start song radio, and adjust a 10-band equalizer |
| 🎤 [Synchronized lyrics](docs/lyrics.md) | Follow word-by-word lyrics and translations in four fullscreen layouts (Fashion, Handwritten, Subtitles, and Dialogue) |
| 🎨 [Appearance](docs/appearance.md) | Choose frosted or liquid glass with Pop Art accents |
| 🖥️ [Desktop windows](docs/desktop.md) | Use desktop lyrics, the desktop island, and the mini player |
| 💾 [Track downloads](docs/storage.md) | Download tracks made available by the source platform |

## 📷 Interface preview

![Home during playback, with the audio visualizer and Now Playing panel](docs/images/home-playback.gif)

![Switching between Fashion, Handwritten, Subtitles, and Dialogue during playback](docs/images/fullscreen-lyrics.gif)

## 💻 Local development

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

[Development environment](docs/DEVELOPMENT.md) · [Packaging and releases](docs/RELEASING.md) · [Report an issue](https://github.com/XiangZi7/MiraiPlayer/issues)

## ⚠️ Disclaimer

This project is for learning and research only. Use it at your own risk. Third parties provide the APIs and data sources. Follow applicable laws and their terms of use. **Commercial use is prohibited.** The project maintainers accept no responsibility for direct or indirect losses or legal liability arising from use of the project.

## 💬 Community and support

| QQ group 2 · 657282337 | QQ group · 442179941 |
| :---: | :---: |
| <img src="https://github.com/user-attachments/assets/d74218a8-8731-4f2a-9925-feb96ca46929" alt="QR code for QQ group 2" width="280" /> | <img src="https://github.com/user-attachments/assets/83786a34-cf75-4268-9f28-7ceb180cc329" alt="QR code for QQ group" width="280" /> |

## 🤝 Related projects

- [HotPulse](https://hotpulse.pages.dev/) · Trending topics aggregator
- [番剧](https://tv.yxcr.top/) · Anime

## 📈 Star history

<a href="https://www.star-history.com/?repos=XiangZi7%2FMiraiPlayer&amp;type=date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=XiangZi7%2FMiraiPlayer&amp;type=date&amp;theme=dark" />
    <img src="https://api.star-history.com/chart?repos=XiangZi7%2FMiraiPlayer&amp;type=date" alt="MiraiPlayer GitHub star history" />
  </picture>
</a>

[latest]: https://github.com/XiangZi7/MiraiPlayer/releases/latest
[releases]: https://github.com/XiangZi7/MiraiPlayer/releases
[dev-builds]: https://github.com/XiangZi7/MiraiPlayer/actions/workflows/release.yml?query=branch%3Amain
[windows-setup]: https://github.com/XiangZi7/MiraiPlayer/releases/download/v0.1.10/MiraiPlayer_0.1.10_windows_x64_setup.exe
[windows-portable]: https://github.com/XiangZi7/MiraiPlayer/releases/download/v0.1.10/MiraiPlayer_0.1.10_windows_x64_portable.zip
[macos-arm64]: https://github.com/XiangZi7/MiraiPlayer/releases/download/v0.1.10/MiraiPlayer_0.1.10_macos_arm64.dmg
[macos-x64]: https://github.com/XiangZi7/MiraiPlayer/releases/download/v0.1.10/MiraiPlayer_0.1.10_macos_x64.dmg
[linux-appimage]: https://github.com/XiangZi7/MiraiPlayer/releases/download/v0.1.10/MiraiPlayer_0.1.10_linux_x64.AppImage
[linux-deb]: https://github.com/XiangZi7/MiraiPlayer/releases/download/v0.1.10/MiraiPlayer_0.1.10_linux_x64.deb
