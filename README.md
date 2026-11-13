# Mirai Music

将 `ui/music-player-glass-vs-minimal.html` 的播放器原稿直接迁入 Tauri 2 + Vue 3 + TypeScript，使用原稿保留的 Tailwind CSS v4 源码。

## 迁移边界

- 主内容区域的 DOM、类名、文案、SVG、布局尺寸、材质与动画取自原稿，未重新设计。
- 桌面应用只显示一个播放器窗口；去掉网页上的对比说明与第二个对比窗口。主窗口默认是原稿 A 毛玻璃，设置仍可切换液态玻璃。
- 仅将外层演示窗口适配为铺满 Tauri 视口，并将窗口按钮、桌面入口接入原生窗口。
- 标题栏按 Windows 桌面习惯适配：去掉红黄绿装饰，使用标准窗口图标和完整点击区域，最大化时同步还原图标；顶栏搜索字号固定为 13px，宽度随窗口调整。
- 原稿交互脚本保留在 `src/pages/index/source-player.js`，封装挂载、销毁和桌面状态通信。内页、历史导航、歌词、队列、设置、平台对接演示与动画继续使用原逻辑，没有另写一套行为。
- 原稿的演示边界不变：歌曲不包含真实音源；平台授权、天气、下载与上传曲库仍按原稿演示流程运行。

## 代码组织

```text
src/
  pages/index/
    index.vue                 # 原稿单窗口首页宿主
    components/source-*.vue   # 原稿标题栏、侧栏、内容区、右栏、全屏和底栏
    source-player.js          # 原稿交互脚本与必要宿主适配
    source-player.d.ts        # Vue / Tauri 适配接口
    source-pagination.ts     # 原稿分页接入公共 Vue 组件
  pages/desktop.vue           # 原稿歌词窗、迷你卡片和媒体控制卡片
  components/ui/
    BaseButton.vue            # 保留原视觉的公共按钮
    SlidingTabs.vue           # 原稿 Tabs、排序和设置分段控件
    PaginationBar.vue         # 原稿分页 DOM、SVG 与滑动胶囊
  styles/main.css             # 原 HTML 内嵌的 Tailwind v4 源码
  services/desktop.ts         # Tauri 窗口调用
  types/prototype.ts          # 原稿与桌面窗口共用类型
src-tauri/src/
  lib.rs                      # 模块导出
  app.rs                      # 插件、命令注册与生命周期组装
  desktop/windows.rs          # 桌面窗口类型、配置、创建、恢复和退出
```

公共组件沿用原来的类名和 DOM 钩子。原稿交互通过这些钩子管理状态，分页保留原来的 FLIP 胶囊动画。源码导入使用 `@/`，新增的宿主方法带中文用途注释。原稿脚本和样式保留原格式，便于与 `ui/` 对照。

字体沿用原网页的 Manrope、Noto Sans SC 与 JetBrains Mono，以本地字体包随应用打包。字体授权见 `public/font-licenses/`。原稿的五张图片已从内嵌数据提取为 `public/images/` 中的同一份 WebP 文件。

## 运行与构建

```sh
pnpm install
pnpm dev
pnpm tauri dev
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
pnpm tauri build --debug --no-bundle
```

Windows 调试应用输出为 `src-tauri/target/debug/miraimusic.exe`。桌面开发需 Rust、Visual Studio C++ 构建工具和 WebView2。
