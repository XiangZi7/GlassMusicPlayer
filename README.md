# Mirai Music

将 `ui/music-player-glass-vs-minimal.html` 的原稿迁入 Tauri 2、Vue 3、TypeScript 和 Tailwind CSS v4。原稿的文案、图片、字体、玻璃材质和动画参数保留，标题栏按 Windows 调整。

## 代码组织

```text
src/
  layouts/player-layout.vue        # 公共播放器宿主、路由缓存和桌面通信
  pages/index/index.vue            # 首页推荐和歌曲列表
  pages/index/components/          # 首页专用主打横幅
  pages/library/index.vue          # 音乐库
  pages/library/components/        # 音乐库专用智能歌单
  pages/search.vue                 # 其余独立页面按业务名直接放置
  pages/desktop.vue                # 独立歌词、迷你播放器和媒体卡片
  pages/settings/index.vue         # 原生设置窗、分类导航、草稿与底栏提交
  pages/settings/components/      # 设置窗专用表单，复用原稿控件
  components/player/               # 跨页面播放器布局、曲目列表、队列及业务标签
  components/ui/                   # 公共按钮、v-model 标签条、分页和通知
  composables/usePlayer.ts         # 类型化播放器上下文
  composables/useSlidingPill.ts    # 标签和分页共用的原稿 FLIP 定位
  stores/player.ts                 # Pinia 中的唯一播放、队列和页面状态
  constants/music.ts               # 原稿曲库、歌词和演示数据
  services/player/runtime.js       # 原稿播放时序、歌词跟随与动画协调
  services/player/fullscreen-motion.js # 原稿全屏分层切歌动画
  services/player/desktop-motion.js # 原稿桌面切歌与歌词动画
  services/desktop.ts              # Tauri 原生窗口调用
  styles/main.css                  # Tailwind 入口与宿主尺寸
  styles/theme.css                 # 原稿颜色和本地字体令牌
  styles/player-effects.css        # 玻璃材质、状态覆盖、伪元素及原始动画
src-tauri/src/
  lib.rs                          # 模块入口
  app.rs                          # 插件、命令和生命周期组装
  desktop/windows.rs              # 桌面窗口配置、创建、恢复和退出
  desktop/appearance.rs           # 原生系统版本检测与主窗口圆角、阴影
  desktop/settings.rs             # 设置原生窗口的创建、恢复与聚焦
  desktop/shadow_hit_test.rs      # Windows 10 透明阴影区的原生命中穿透
```

每个完整页面有真实 Vue Router 路由，切页保留播放和表单状态。需要私有组件的首页和音乐库使用 `pages/业务名/index.vue` 与就近的 `components/`；其余页面直接使用 `pages/业务名.vue`。歌曲、队列、导入、上传、下载和自建歌单由 Vue 列表渲染，公共标签与分页提供 `v-model`。

布局、尺寸、间距和常规排版使用模板中的 Tailwind utilities。复杂玻璃材质、主题覆盖、CSS 变量变换及动画保留原 CSS 级联。切歌继续使用原 Web Animations 关键帧、延迟和曲线；保留旧封面幽灵、连续切歌取消、歌词跟随、光带、视差和减少动态效果设置。

Windows 标题栏移除红黄绿装饰，使用最小化、最大化/还原、关闭按钮；顶栏搜索为 13px，宽度随窗口调整。原网页的 Manrope、Noto Sans SC 和 JetBrains Mono 本地打包，授权在 `public/font-licenses/`。五张原图以相同 WebP 数据保存在 `public/images/`。

Windows 10 主窗口使用 8px 圆角、透明阴影留白和柔和外阴影，保持原内容区域的默认尺寸；最大化时取消留白、圆角与自绘阴影，还原后恢复。Windows 11 按原生构建号识别，使用系统圆角和阴影。透明区域内侧补有八方向缩放入口。

Windows 10 阴影留白通过原生鼠标命中计算切换穿透，点击交给下面的窗口；内容区恢复正常操作，拖动或缩放捕获期间保持交互。设置窗口复用同一套外框处理。全屏播放页顶部增加原生拖动区域，返回和队列按钮保留点击行为。

设置使用独立 Tauri 原生窗口，主界面继续播放并保留当前页面。窗口按“通用、音质、外观、桌面、快捷键、关于”分类，右侧内容独立滚动，底栏固定。原稿卡片、开关、滑动标签和字体保持不变；重置修改本窗口草稿，应用将整份偏好同步回主播放器，保存应用后关闭，取消放弃未应用的改动。

原稿演示边界保留：歌曲没有真实音源；平台授权、天气、下载和上传曲库使用原稿演示流程。

## 运行和验证

```sh
pnpm install
pnpm tauri dev
pnpm build
pnpm check:motion
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --lib desktop::
pnpm tauri build --debug --no-bundle
```

`check:motion` 与 `ui/` 原稿核对全屏和桌面切歌的关键帧、时长、延迟、缓动、全屏关闭时序及 CSS 关键帧。前端单独预览可用 `pnpm dev --port 4183`；Tauri 开发使用 `127.0.0.1:1420`，避开 Windows 上 `localhost` 优先解析到已占用 IPv6 地址的情况。`pnpm tauri dev` 会自动启动 Vite，请勿同时运行另一个默认端口的 `pnpm dev`。Windows 调试应用输出为 `src-tauri/target/debug/miraimusic.exe`。
