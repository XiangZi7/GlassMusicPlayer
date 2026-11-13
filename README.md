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
```

每个完整页面有真实 Vue Router 路由，切页保留播放和表单状态。需要私有组件的首页和音乐库使用 `pages/业务名/index.vue` 与就近的 `components/`；其余页面直接使用 `pages/业务名.vue`。歌曲、队列、导入、上传、下载和自建歌单由 Vue 列表渲染，公共标签与分页提供 `v-model`。

布局、尺寸、间距和常规排版使用模板中的 Tailwind utilities。复杂玻璃材质、主题覆盖、CSS 变量变换及动画保留原 CSS 级联。切歌继续使用原 Web Animations 关键帧、延迟和曲线；保留旧封面幽灵、连续切歌取消、歌词跟随、光带、视差和减少动态效果设置。

Windows 标题栏移除红黄绿装饰，使用最小化、最大化/还原、关闭按钮；顶栏搜索为 13px，宽度随窗口调整。原网页的 Manrope、Noto Sans SC 和 JetBrains Mono 本地打包，授权在 `public/font-licenses/`。五张原图以相同 WebP 数据保存在 `public/images/`。

原稿演示边界保留：歌曲没有真实音源；平台授权、天气、下载和上传曲库使用原稿演示流程。

## 运行和验证

```sh
pnpm install
pnpm tauri dev
pnpm build
pnpm check:motion
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
pnpm tauri build --debug --no-bundle
```

`check:motion` 与 `ui/` 原稿核对全屏和桌面切歌的关键帧、时长、延迟、缓动、全屏关闭时序及 CSS 关键帧。前端单独预览可用 `pnpm dev --port 4183`；Tauri 开发默认使用 1420，请勿重复启动同端口服务。Windows 调试应用输出为 `src-tauri/target/debug/miraimusic.exe`。
