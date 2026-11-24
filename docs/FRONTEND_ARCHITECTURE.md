# 前端目录与播放状态

## 从一次点播看代码

```text
搜索 / 公开歌单详情 / 本机音乐库
  → 页面将目标曲目或曲单交给播放器
  → Pinia 登记曲目标识、当前索引和队列
  → 播放控制器请求音源并驱动媒体元素
  → 响应媒体事件，更新底栏、歌词和桌面窗口
```

在线列表可以先展示公开资料。点播时才获取该曲当次可用的播放地址；切换歌曲会取消或忽略上一轮结果。地址和短期授权与可长期保存的歌曲身份分开处理。

## 从目录找到入口

| 要改的内容 | 主要入口 | 负责的边界 |
| --- | --- | --- |
| 主窗口和跨页播放 | [主布局](../src/layouts/player-layout.vue)、[播放器上下文](../src/composables/usePlayer.ts) | 挂载控制器，向页面传递播放器状态和操作 |
| 搜索和公开歌单 | [搜索页](../src/pages/search.vue)、[公开歌单加载](../src/pages/index/public-playlists.ts)、[发现详情](../src/pages/discovery.vue) | 关键词、平台分页、取消请求、完整列表和重试 |
| 当前队列和音乐库 | [播放器 Store](../src/stores/player.ts)、[曲库服务](../src/services/player/library.ts) | 当前歌曲、队列位置、导入和播放状态 |
| 渲染与音频 | [播放器运行时](../src/services/player/runtime.js)、[均衡器](../src/services/player/equalizer.ts) | 媒体事件、时钟、过渡和音频处理 |
| 设置 | [设置窗](../src/pages/settings/index.vue) | 分类导航、草稿、应用、保存和取消 |
| 原生操作 | [桌面服务](../src/services/desktop.ts)、[Rust 命令注册](../src-tauri/src/app.rs) | 窗口、托盘、存储和设备授权 |

## 路由、复用与恢复

Vue Router 使用 hash 路由。首页和每日推荐详情复用页面组件。发现详情把平台与 ID 放在路由里，从详情返回时可恢复到原歌单卡片。本机导入的歌单从自己的列表读取，发现详情则从平台分页读取；仅浏览公开详情不用写入用户音乐库。[路由表](../src/router/index.ts)

跨页面组件放在 `src/components/player/` 与 `src/components/ui/`。首页、音乐库、设置的私有组件在各自页面目录下。模板保留界面的键盘和焦点契约，复杂动画的取消与时序由已有运行时统一协调。

## 浏览器与原生窗口

主播放器管理音频和播放进度，桌面表面接收状态并将控制意图送回主窗。设置窗使用草稿，应用或保存时才同步偏好。浏览器预览走网页路径；系统目录选择、下载文件写入、托盘菜单与系统凭据依赖 Tauri 命令。[窗口实现](../src-tauri/src/desktop/) · [偏好持久化](../src/services/player/preferences.ts)

## 核对变更

`pnpm build` 会运行 Vue 类型检查、Vite 生产构建和压缩 CSS 检查。改队列时核对虚拟行的绝对位置；改全屏时运行 `pnpm check:motion` 和 `pnpm check:fullscreen`；改原生窗口时运行 `pnpm check:native` 并实际打开相应窗口。[完整验证入口](PERFORMANCE.md)
