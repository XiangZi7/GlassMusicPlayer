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
  utils/http.ts                    # Axios 请求工厂及统一错误处理
  api/index.ts                     # 业务接口路径、参数和响应类型
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

在线搜索、公开歌单导入及曲目点播使用 MiraiMusic-Server 的 FastAPI。导入歌单保存于当前播放器的本机存储，播放权限以原平台当次返回为准。本地样例、下载和上传曲库仍沿用原稿演示流程；天气已改为用户当前位置的真实接口数据，详见下方说明。

在标题栏或搜索页输入后按回车或点击放大镜提交。「平台对接」统一使用含「登录平台 / 主页链接」的弹窗，网易云和酷狗优先展示扫码，酷我使用公开主页。关联记录和完整导入的公开歌单保存在本机。

无需登录也可在「粘贴分享内容」直接粘贴 App 分享文字或多行公开歌单详情链接，每批最多 50 个；自动提取链接、去重并逐份完整保存。已导入歌单仍可勾选更新，支持全选/取消本页并保留其他分页选择。单项失败不阻断后续歌单，统一通知批次结果并可仅重试未完成项；主动停止或离开页面不会丢失已保存的歌单，旧请求不能写入新批次。每份歌单完整读取成功后才覆盖旧版本。批量导入留在当前页，单链接全部成功时自动打开歌单。短链接暂不展开；重试队列属于当前页面会话，刷新应用后不保留。

| 平台   | 扫码登录                                        | 个人主页 / UID | 公开歌单分享链接 |
| ------ | ----------------------------------------------- | -------------- | ---------------- |
| 网易云 | 已接入真实二维码和上游身份确认                  | 支持           | 支持             |
| 酷我   | 本次不接第三方授权，保留明确未支持提示          | 支持           | 支持             |
| 酷狗   | 已接入真实二维码与账户 UID 验证，仅关联公开身份 | 不读取账户歌单 | 支持             |

网易云与酷狗扫码使用 MiraiMusic-Server 的短期身份接口：二维码由真正的上游 key 在服务端本地生成；只有上游明确确认授权并通过账户 UID 一致性验证，才接受公开资料。网易云继续读取同一 UID 的公开歌单，并将昵称、头像和关联记录一次保存；读取失败可在已确认身份面板重试。酷狗只保存经验证的公开身份，不读取需要 token 的账户歌单，仍支持公开分享链接导入。二维码的「已扫码」不等于身份已确认。

右上只显示公开头像或中性用户图标，不显示固定演示用户；悬停、点击或方向键可打开三个平台选项，支持 Home/End、Escape、焦点移出与外部点击关闭。设置入口在头像旁；侧栏不再包含用户/设置或桌面小窗入口。刷新公开歌单不会丢失同一账号头像，也不会复用另一 UID 的头像。

**扫码只关联公开资料，不是长期登录、私人歌单或会员音源授权。** Cookie/token 不传给客户端、不写入本机存储，不会写入后端的 `NETEASE_COOKIE` 或自动开启会员播放。客户端仅白名单保存公开 UID、昵称、头像与同步时间。确认身份后立即取消服务端流程释放容量；关闭弹窗、切换方式/平台、离开缓存路由或过期也会取消。旧请求不能恢复状态；酷我不接第三方账号授权，也不生成占位二维码。

系统托盘右键显示原生菜单，选择「迷你播放器」「桌面歌词」「媒体控制卡片」分别打开对应小窗；左键恢复主窗，也可在托盘打开设置或明确选择退出。迷你卡失焦或按 Escape 收起。桌面歌词、迷你卡、媒体卡和独立灵动岛可右键「关闭小窗」，只隐藏当前表面，不退出主播放器。四种表面均保留原稿本体尺寸、圆角和四边 32px 透明阴影留白；暗玻璃增强背景遮蔽，小阴影避免底部硬切。CSS `backdrop-filter` 只模糊同一 WebView 内背景，这里没有启用或承诺 Windows 原生桌面 blur。媒体卡仍是原稿模拟 SMTC，不代表已接入 Windows 系统媒体会话。

所有相关空列表只呈现居中 SVG 图标，无可见占位文案，辅助技术仍能读取空态说明。底部频谱采用不超过 2px 的细条并跟随歌曲封面主色；在线音频使用真实分析数据，仅原稿演示曲目使用显式 demo 节奏，减少动态效果会停止动画。

平台标识以本地 Iconify SVG 渲染。网易云图形来自 [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/neteasecloudmusic.svg)，酷狗和酷我图形参考其应用图标绘制。 [酷狗音乐](https://apps.apple.com/cn/app/id472208016) · [酷我音乐](https://apps.apple.com/cn/app/id588673713)

## 用户当前位置天气

标题栏与全屏复用同一个天气驱动，使用宿主的 `getCurrentPosition` 获取本次位置，再请求 Open-Meteo 当前天气。不会用固定城市、IP 推测、固定 19° 或演示数据兜底。定位与网络请求中、无权限、不支持、失败、无有效数据或数据超过 30 分钟时不显示天气；成功以 200ms 淡入/轻移呈现，减少动态效果时不做过渡。

权限查询、一次定位、以及「天气 HTTP + JSON」各有 8 秒预算；约每 15 分钟刷新，两个组件及重复刷新不会叠加请求。权限撤销或宿主明确拒绝时立即隐藏并停止自动重试。位置不落盘、不进入 HMR 快照或日志，发给天气服务前经纬度舍入到约一公里网格；请求不带 Cookie，不发送 referrer，不接受重定向。天气仍依赖用户在宿主/Windows 中允许定位以及可用网络，本项目不会替用户绕过拒绝；无权限时隐藏是预期行为。Open-Meteo 数据用于当前天气展示，不是本地气象站的精确实测保证。

## 运行和验证

先在 MiraiMusic-Server 仓库启动 `uv run --locked uvicorn main:app`。播放器默认请求 `http://127.0.0.1:8000`，也可以在 Vite 环境中设置 `VITE_APP_BASE_API` 指向其他服务地址。公开歌单导入支持三平台带数字 ID 的歌单详情链接。

```sh
pnpm install
pnpm tauri dev
pnpm build
pnpm check:motion
pnpm check:spectrum
pnpm check:desktop
pnpm check:platform-login
pnpm check:platform-import
pnpm check:weather
pnpm check:native
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --lib desktop::
pnpm tauri build --debug --no-bundle
```

`check:motion` 与原稿核对全屏和桌面切歌的关键帧、时长、延迟、缓动、全屏关闭时序及 CSS 关键帧。`check:platform-login` 为 33 组模拟流程/身份/键盘回归，`check:platform-import` 为 27 组公开资料/批量导入/更新/重试/存储/取消/导航/分页回归，`check:weather` 为 65 组模拟定位/数据/生命周期/组件检查；它们不代表真人扫码或定位授权已通过。`check:desktop` 保留原桌面检查，并追加 12 组头像菜单模拟、2 组连接弹窗初始化回归及 7 个 SFC 的编译验证。

构建还会自动执行 [压缩 CSS 检查](scripts/check-built-css.mjs)，确认三张桌面卡片及灵动岛的标准 `backdrop-filter` 声明仍保留。WebKit 前缀后写可能使压缩产物只剩该前缀，而当前 WebView 不识别它；源声明顺序已修正，验收仍以实际 WebView 的计算样式为准。

Windows 下 `check:native` 需要已安装的 Windows SDK `mt.exe`：Tauri 的单元测试产物未自动携带应用已有的 Common-Controls v6 声明，可能在载入 `TaskDialogIndirect` 时以 `0xc0000139` 退出。脚本从 Cargo 输出定位且校验本项目的测试 EXE，只为该生成产物补相同声明，再运行真实 Rust 桌面单元测试；不修改主程序、源码或系统库，也不会安装 SDK。这与真实托盘/UIA 点击验收仍是不同层面的验证。前端单独预览使用 `pnpm dev`。浏览器与 Tauri 开发都使用 `127.0.0.1:1420`，FastAPI 按此来源放行跨域请求。`pnpm tauri dev` 会自动启动 Vite。Windows 调试应用输出为 `src-tauri/target/debug/miraimusic.exe`。
