# MiraiPlayer 打包与发布

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

## 构建测试包

包含源码或构建配置的推送到达 `main` 时会自动打包并保留 Actions 附件。其他分支也可以手动触发同一流程。

1. 将源码、锁文件和工作流提交到 GitHub。手动运行按钮需要该工作流已存在于仓库默认分支。
2. 打开 **Actions → Desktop packages → Run workflow**，选择要打包的分支。
3. 在完成的运行页面展开 **Artifacts**。四个按平台命名的归档保留 14 天，每个归档包含本平台安装文件和校验清单。

前端构建包含 TypeScript 检查和压缩后 CSS 检查。各平台执行 EQ 回归、Rust 原生与存储测试，再打包。可在失败的任务日志中找到具体的编译、测试、打包或上传步骤。[发行工作流](../.github/workflows/release.yml)

## 发布带版本号的草稿

`package.json` 提供桌面应用、安装器和“设置 → 关于”所用的版本号。Rust 包还在 `src-tauri/Cargo.toml` 与 `src-tauri/Cargo.lock` 记录同一版本。发行标签使用 `v主版本.次版本.修订号`。

1. 在 `package.json` 与 `src-tauri/Cargo.toml` 设置目标版本。执行 `cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1` 更新 Cargo 锁文件，核对版本差异。
2. 执行 `pnpm check:release` 检查版本和发布信息，提交准备发布的源码与锁文件。
3. 在该提交创建并推送对应标签。例如，要发行源码中已经设置好的 0.1.0，可运行下面两条命令。

```sh
git tag -a v0.1.0 -m "MiraiPlayer v0.1.0"
git push origin v0.1.0
```

推送标签后，工作流先核对标签和应用版本。四个构建任务全部成功后，发布任务逐个平台核验 SHA-256，汇总六个附件及一份 `SHA256SUMS.txt`，生成带变更记录的 GitHub Release 草稿。维护者可以先下载试用，检查说明后点击 **Publish release**。构建任务仅用仓库读取权限，创建草稿的任务使用 GitHub 自动提供的 `GITHUB_TOKEN` 写入 Release。

同一运行可用 **Re-run failed jobs** 重试。已有同标签草稿时会更新附件；已公开的版本受到保护。修复源码后应在新的提交使用新版本号和新标签。

## 本机打包

在需要打包的平台上安装 Node.js 22.22.2、pnpm 10.33.0 和 Rust 1.96.0。Windows 需要 Visual Studio C++ Build Tools、Windows SDK、WebView2 以及系统自带的 `tar.exe`；macOS 需要 Xcode Command Line Tools。Ubuntu 22.04 的 apt 安装命令列在工作流的 **Install Linux desktop and media libraries** 步骤。[Tauri 开发环境](https://v2.tauri.app/start/prerequisites/) · [工作流](../.github/workflows/release.yml)

```sh
pnpm install --frozen-lockfile
pnpm release:build
```

Tauri 原始安装包位于 `src-tauri/target/release/bundle/`。已命名的分发包及本平台 SHA-256 清单位于 `src-tauri/target/distribution/<版本>/<平台>/`。Windows ZIP 只收集编译后的可执行文件。在线曲库使用构建时配置的后端，自建服务可在打包前设置 `VITE_APP_BASE_API`。

## 核验下载

在 PowerShell 中执行 `Get-FileHash .\文件名 -Algorithm SHA256`，与清单中同名文件的值比较。在 macOS 使用 `shasum -a 256 文件名`，在 Linux 使用 `sha256sum 文件名`。如已下载全部附件，可在同一目录执行 `shasum -a 256 -c SHA256SUMS.txt` 或 `sha256sum -c SHA256SUMS.txt`。
