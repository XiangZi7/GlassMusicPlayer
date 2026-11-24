# MiraiPlayer

MiraiPlayer 是一款玻璃风格的桌面音乐播放器。可以从网易云、酷我和酷狗搜索曲目、导入公开歌单，在全屏舞台跟随逐字歌词，也可以把歌词或播放控件单独放到桌面上。

[下载发行版](https://github.com/XiangZi7/GlassMusicPlayer/releases) · [查看云构建](https://github.com/XiangZi7/GlassMusicPlayer/actions/workflows/release.yml) · [English](README.en.md)

![MiraiPlayer 首页的每日推荐、发现歌单和今日曲目](docs/images/home.png)

## 下载与安装

在 GitHub Releases 中展开对应版本的 **Assets**，按系统和芯片选择文件。手动云构建的测试包可在对应 Actions 运行的 **Artifacts** 中下载。

| 系统 | 下载文件后缀 | 安装方式 |
| --- | --- | --- |
| Windows x64 | `windows_x64_setup.exe` | 运行安装向导，默认安装到当前用户 |
| Windows x64 免安装版 | `windows_x64_portable.zip` | 解压后运行 `miraiplayer.exe`，需要 WebView2 Runtime |
| macOS Apple Silicon | `macos_arm64.dmg` | 打开磁盘映像，把 MiraiPlayer 拖入“应用程序” |
| macOS Intel | `macos_x64.dmg` | 在“关于本机”中确认处理器为 Intel 后选择此包 |
| Linux x64 | `linux_x64.deb` | 在 Debian / Ubuntu 系统上使用 `sudo apt install ./文件名.deb` |
| Linux x64 | `linux_x64.AppImage` | 使用 `chmod +x 文件名.AppImage` 添加执行权限，再运行文件 |

macOS 安装包要求 13.3 或更高版本。Linux 包在 Ubuntu 22.04 构建。预览包的签名状态、系统依赖和 SHA-256 核验方式见[发行指南](docs/RELEASING.md)。

## 开始听歌

1. 在标题栏搜索歌名或歌手，选择一首曲目开始播放。音源可用性、试听范围和歌词数据由上游平台决定。
2. 在“平台对接”粘贴公开歌单的分享文字或详情链接，导入后即可从侧栏打开。已导入的歌单和偏好设置保存在本机。
3. 打开全屏播放，可切换时尚、手书、字幕和对话四种歌词舞台。平台提供逐字时间戳时按字填色，普通 LRC 按句跟随。
4. 从系统托盘打开桌面歌词、迷你播放器或媒体卡片。可在设置中选择玻璃材质、开关动效、调节 EQ 或设置下载目录。

## 从源码运行

安装 Node.js 22.22.2、pnpm 10.33.0、Rust 1.96.0 和当前平台的 Tauri 开发依赖。Windows 使用 MSVC 与 WebView2，macOS 需要 Xcode Command Line Tools，Linux 的依赖列表见发行工作流。[Tauri 环境准备](https://v2.tauri.app/start/prerequisites/)

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

浏览器预览可运行 `pnpm dev`。桌面开发和浏览器预览共用 1420 端口。默认在线服务为 `https://music-api.yxcr.top`，自建后端时在项目根目录的 `.env.local` 设置 `VITE_APP_BASE_API`，重启或重新构建后生效。

## 文档

- [开发与验证](docs/DEVELOPMENT.md) 包含代码结构、平台支持、用户数据存储和现有回归命令。
- [打包与发布](docs/RELEASING.md) 包含本机打包、GitHub 云构建、版本标签、安装包校验和发布草稿。
- [字体授权](public/font-licenses/) 和 [地名数据来源](public/data-licenses/geonames.txt) 随项目分发。
