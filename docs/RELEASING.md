# MiraiPlayer 打包与发布

在 GitHub Actions 的 **Desktop packages** 中选取分支、查看四个构建任务，或下载未发布的开发包。带版本标签的推送走同一组构建任务，全部通过后自动发布 GitHub Release。[云构建](https://github.com/XiangZi7/MiraiPlayer/actions/workflows/release.yml) · [已发布版本](https://github.com/XiangZi7/MiraiPlayer/releases)

## 平台与产物

GitHub Actions 使用四个原生构建任务，生成六个面向用户的文件。文件名以 `MiraiPlayer_<版本>_` 开头，后缀如下。

| 构建环境 | 文件后缀 | 用途 |
| --- | --- | --- |
| Windows x64 | `windows_x64_setup.exe` | 中英文可选的 NSIS 当前用户安装包 |
| Windows x64 | `windows_x64_portable.zip` | 含独立的 `miraiplayer.exe`，配置和歌单仍保存在系统应用数据目录 |
| macOS Intel | `macos_x64.dmg` | Intel 版应用磁盘映像 |
| macOS Apple Silicon | `macos_arm64.dmg` | Apple Silicon 版应用磁盘映像 |
| Ubuntu 22.04 x64 | `linux_x64.deb` | 由包管理器安装并处理运行依赖 |
| Ubuntu 22.04 x64 | `linux_x64.AppImage` | 独立运行，包含播放音频所需的 GStreamer 框架 |

Windows 免安装版需要系统具备 WebView2 Runtime，安装版可在缺少运行时时下载。当前流程生成的 Windows 文件没有 Authenticode 签名。macOS 包使用 ad-hoc 签名，未做 Developer ID 公证，Gatekeeper 可能要求用户确认来源。Linux AppImage 的兼容范围取决于目标系统的 glibc、FUSE 和桌面环境。Linux 音频依赖配置依据 [Tauri 的 AppImage 多媒体说明](https://v2.tauri.app/distribute/appimage/#multimedia-support-via-gstreamer)。

## 构建开发包

包含源码或构建配置的推送到达 `main` 时会自动打包并保留 Actions 附件。其他分支也可以手动触发同一流程。

1. 将源码、锁文件和工作流提交到 GitHub。手动运行按钮需要该工作流已存在于仓库默认分支。
2. 打开 **Actions → Desktop packages → Run workflow**，选择要打包的分支。
3. 在完成的运行页面展开 **Artifacts**。四个按平台命名的归档保留 14 天，每个归档包含本平台安装文件和校验清单。

各平台先核对发行版本和元数据，再由 Tauri 执行前端类型检查、生产构建和原生打包。可在失败的任务日志中定位对应步骤。[发行工作流](../.github/workflows/release.yml)

### 找到要下载的文件

每个运行有四个 Actions 归档，名称后缀分别为 `windows_x64`、`macos_x64`、`macos_arm64`、`linux_x64`。GitHub 下载的外层 ZIP 是归档容器；先解压，再打开内部的安装文件或免安装 ZIP。GitHub Releases 提供六个安装文件、汇总的 `version.json` 和 `SHA256SUMS.txt`，直接点击即可下载。

### 缓存和构建环境

前端依赖按 pnpm 锁文件安装，Rust 使用锁定依赖。工作流分别缓存 pnpm 包和各平台的 Cargo 依赖。首次运行或工具链、锁文件变化后，编译时间通常更长。新检出无需本机设计稿、用户歌单或后端源码目录。

## 发版命令

`package.json` 是桌面和安装器的版本来源，Tauri 配置引用这个文件。发版命令会同时更新 Rust manifest 和 Cargo 锁文件中 MiraiPlayer 的条目。先将准备发布的代码提交到目标分支，通常是 `main`。

| 操作 | 命令 | 结果 |
| --- | --- | --- |
| 预览 | `pnpm release --dry-run` | 查看下一版本和推送目标 |
| 发补丁版 | `pnpm release` | 递增修订号，提交版本，并一次推送当前分支和新标签 |
| 发次版本或主版本 | `pnpm release minor` 或 `pnpm release major` | 递增相应版本段，后续段归零 |
| 重试推送 | `pnpm release --retry vX.Y.Z` | 复用上次准备好的本地提交和标签 |
| 校验版本 | `pnpm version:check` | 检查应用、桌面配置和 Rust 版本来源 |
| 指定版本 | `pnpm version:set vX.Y.Z` | 仅更改本地版本文件；也支持 `-alpha.1`、`-beta.1` 和 `-rc.1` |

默认补丁版本从本地应用版本及远端、本地版本标签中的最高版本递增。如果要首次发布当前已设置的版本，先运行 `pnpm check:release`，在干净的发布提交上手动创建并推送与该版本一致的注解标签。

版本标签触发四个构建任务。发布任务核对每个平台的源提交、版本、架构和 SHA-256，根据上次公开版本以来的提交生成中文更新日志与安装包直链。全部附件上传完成后公开 Release。预发布标签会标为 *Pre-release*。

构建环境临时故障时可重跑失败任务，或在工作流手动运行时填写已推送的版本标签。如果修复涉及源码或工作流，先提交修复，再运行 `pnpm release` 创建指向新提交的标签。已有草稿可继续上传。普通主分支推送和留空标签的手动运行只产生开发包。

### 启用应用内更新

正式版通过 GitHub Releases 的 `version.json` 检查版本。两项签名配置均留空时，流程继续发布六种分发包、版本信息和校验清单，用户可在发行页获取新版本。

要启用应用内下载和安装，在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置下表。使用 Tauri 签名工具生成的本项目密钥对，并离线备份私钥与密码。已安装的客户端会使用内置公钥验证后续更新，后续版本应沿用同一对密钥。[Tauri 更新签名说明](https://v2.tauri.app/plugin/updater/#signing-updates)

| 名称 | 类型 | 填写内容 |
| --- | --- | --- |
| `TAURI_UPDATER_PUBLIC_KEY` | Variable | Tauri 生成的 `.pub` 文件内容 |
| `TAURI_SIGNING_PRIVATE_KEY` | Secret | 对应私钥文件的内容 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Secret | 生成密钥时设置的密码，无密码时留空 |

版本标签构建时，工作流将公钥编入应用并签名 Windows NSIS、两个架构的 macOS 应用归档和 Linux AppImage。发布任务用同一公钥验证各文件，并将签名记录的版本与 Git 标签核对。通过后，随版本上传四个签名、两个 macOS 更新归档和 `latest.json`，并在 `version.json` 标记 `updater: true`。只配置公钥或私钥其中一项时，构建会报告缺项。

用户首次安装内置公钥的版本后，即可在后续正式版发布时从右上角或「设置 → 关于」更新。Windows 免安装版和 Linux DEB 通过发行页更新。

### 排查失败步骤

| 现象 | 核对位置 | 处理 |
| --- | --- | --- |
| 版本校验失败 | 标签、`package.json`、Rust manifest 与 lock 中的本项目条目 | 将目标版本同步后重新运行本地校验 |
| Linux 打包缺少桌面库或媒体组件 | apt 安装步骤、WebKitGTK 4.1、GStreamer | 使用工作流列出的依赖和构建发行版 |
| Windows 打包工具临时下载失败 | `Build desktop packages` 的 NSIS 下载日志 | 确认上游恢复后重试失败任务 |
| 同名标签已有正式版 | 发布步骤和已有附件 | 保留已发布文件，准备下一版本标签 |

安装器的系统代码签名、macOS 公证和文件 SHA-256 服务于不同的验证环节。SHA-256 可对照下载文件的字节内容；当前部署的签名状态见本文平台说明。

## 本机打包

在需要打包的平台上安装 Node.js 22.22.2、pnpm 10.33.0 和 Rust 1.96.0。Windows 需要 Visual Studio C++ Build Tools、Windows SDK、WebView2 以及系统自带的 `tar.exe`；macOS 需要 Xcode Command Line Tools。Ubuntu 22.04 的 apt 安装命令列在工作流的 **Install Linux desktop and media libraries** 步骤。[Tauri 开发环境](https://v2.tauri.app/start/prerequisites/) · [工作流](../.github/workflows/release.yml)

```sh
pnpm install --frozen-lockfile
pnpm release:build
```

本机运行后，打开仓库根目录的 `release-output/`。Windows x64 构建会生成以下四个文件。

| 文件 | 内容 |
| --- | --- |
| `MiraiPlayer_<版本>_windows_x64_setup.exe` | NSIS 安装器 |
| `MiraiPlayer_<版本>_windows_x64_portable.zip` | 解压可运行的 `miraiplayer.exe` |
| `version.json` | 应用版本、对应标签名、Git 提交、平台和架构 |
| `SHA256SUMS.txt` | 两个分发包和版本信息的 SHA-256 |

`release-output/` 按 MiraiHub 的约定由 Git 忽略。Tauri 原始安装包位于 `src-tauri/target/release/bundle/`，按版本与平台的副本位于 `src-tauri/target/distribution/<版本>/<平台>/`。本机只构建当前系统的包，GitHub Actions 在四个原生环境分别构建。在线曲库使用构建时配置的后端，自建服务可在打包前设置 `VITE_APP_BASE_API`。

## 核验下载

在 PowerShell 中执行 `Get-FileHash .\文件名 -Algorithm SHA256`，与清单中同名文件的值比较。在 macOS 使用 `shasum -a 256 文件名`，在 Linux 使用 `sha256sum 文件名`。如已下载全部附件，可在同一目录执行 `shasum -a 256 -c SHA256SUMS.txt` 或 `sha256sum -c SHA256SUMS.txt`。
