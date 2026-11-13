# Mirai Music

基于 `ui/music-player-glass-vs-minimal.html` 迁移的 Tauri 2 桌面音乐播放器。使用 Vue 3 Composition API、TypeScript、Pinia、Vue Router 与 Tailwind CSS v4。

## 开发与构建

```sh
pnpm install
pnpm dev                             # 浏览器预览
pnpm tauri dev                       # 桌面开发
pnpm build                           # TypeScript 检查 + 前端生产构建
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri build --debug --no-bundle  # 生成可运行的调试版应用
pnpm tauri build                     # 正式构建与安装包
```

桌面开发需要 Rust、Visual Studio C++ 构建工具与 WebView2。Windows 调试版输出到 `src-tauri/target/debug/miraimusic.exe`。

## 代码组织

- `src/layouts/player-layout.vue`：应用布局、自定义标题栏、快捷键与桌面窗口通信。
- `src/pages/index/index.vue`：首页；专属播放器与横幅组件就近放在 `pages/index/components/`。
- `src/pages/`：搜索、音乐库、收藏详情、电台、导入、设置与独立桌面窗口视图。
- `src/components/ui/`：统一按钮、滑动 Tabs、分页、图标与通知组件。
- `src/components/music/`：各页面复用的歌曲列表和专辑、歌手卡片。
- `src/stores/player.ts`：主窗口唯一音频引擎、队列、播放记录与持久化偏好。
- `src/services/`：本地音频存储、桌面命令与公共通知。
- `src/styles/main.css`：Tailwind v4 入口、设计 token 与必要的玻璃、动效样式。
- `src-tauri/src/lib.rs`：模块入口，只导出应用启动函数。
- `src-tauri/src/app.rs`：插件、命令注册与生命周期组装。
- `src-tauri/src/desktop/`：按桌面业务归属管理窗口类型、尺寸、创建、恢复和退出。

应用源码使用 `@/` 导入。业务方法带中文用途注释，Rust 端不使用 `unwrap()` 处理可恢复的窗口错误。独立小窗由 Rust 命令创建；只有主窗口播放音频，小窗通过事件发送操作并接收快照。

字体沿用原稿：英文 Manrope、中文 Noto Sans SC、等宽数字 JetBrains Mono，均以可变字体随应用打包，离线可用。字体授权文件随资源放在 `public/font-licenses/`。

## 功能与数据

保留原稿封面与立绘、毛玻璃 / 液态玻璃、首页、搜索、曲库分类、歌单、全屏歌词、播放队列、分页、排序、收藏、最近播放和睡眠定时器。按钮统一使用 `BaseButton`，Tabs 使用 `SlidingTabs`，分页使用 `PaginationBar`。

本地音频支持文件选择、文件夹选择和递归拖放导入，音频存储在 WebView 的 IndexedDB，元数据、歌单和偏好保存在本地。MP3、WAV、FLAC、OGG 等格式的实际解码能力由系统 WebView 决定；不支持的文件会显示操作通知。歌名和歌手优先从「歌手 - 歌名」文件名拆分，歌词暂不自动匹配。

24 首原稿歌曲与双语歌词属于演示数据，预览进度不含真实音频；天气也明确标记为演示。第三方平台保留入口并标记尚未接入官方授权，不伪造登录和下载成功。支持以下格式的歌单文件与本地曲库按歌名、歌手匹配：

```json
{
  "name": "我的收藏",
  "tracks": [{ "title": "Midnight Drift", "artist": "Neon Coast" }]
}
```

桌面歌词与迷你播放器使用独立置顶窗口，歌词支持字号、透明度与点击穿透。锁定后可点击主窗口的「悬浮歌词窗」解除锁定。系统媒体控制使用 Media Session，具体支持程度取决于 WebView2。系统托盘、均衡器、交叉淡化、实时天气与多设备同步尚未接入。
