# README 图片

中英文 README 共用九张功能图，顶部各用一张 1600 × 800 的头图。头图左侧为对应语言的产品介绍，右侧叠放两张播放器截图。[中文首页](../../README.md) · [English README](../../README.en.md)

## 素材与来源

| 文件 | 内容 | 采集方式 |
| --- | --- | --- |
| `showcase-hero-zh.png`、`showcase-hero-en.png` | 双语头图 | 本地浏览器渲染 [头图排版](showcase.html)，嵌入首页与时尚舞台截图 |
| `feature-home.png` | 完整主窗口、每日推荐和发现 | 匿名浏览器打开当前应用，后端返回三平台公开歌单 |
| `feature-playlist.png` | 网易云新歌榜详情 | 从首页打开歌单，等待实际完整曲目列表出现 |
| `feature-platforms.png` | 三个平台的公开连接入口 | 未关联账号的浏览器会话 |
| `feature-import.png` | 批量导入的歌单选择状态 | 隔离的界面回归样本 |
| `feature-fashion.png`、`feature-ink.png`、`feature-subtitles.png` | 同一曲目的三种歌词排版 | 播放器组件真实渲染，歌曲、时间轴、译文及天气来自浏览器回归样本 |
| `feature-equalizer.png`、`feature-desktop.png` | 音质与桌面设置 | 当前应用的独立设置路由，使用默认草稿 |
| `home.png` | 首页内容区近景 | 之前保存的匿名公开推荐截图，供平台指南对照 |

功能图来自网页渲染，系统任务栏、边框、安装器和系统音频设备不在截图范围内。公开歌单每天可能变化；图中样本账号及样本歌词用于说明交互，平台的实际返回以使用时为准。

## 重新采集

1. 安装项目依赖，启动 `pnpm dev` 或使用已经运行的开发服务。使用独立 Edge / Chromium 配置，不打开日常使用的账号资料。
2. 在仓库根目录执行下面的命令。首次采集需要后端可访问，且允许该预览来源的公开请求。
3. 打开两张头图和九张功能图，确认封面、字体及选中态完整，截图中没有私有歌单、登录二维码、播放凭据或系统路径，再提交文档素材。

```sh
node docs/images/capture.mjs
node docs/images/capture.mjs --hero
```

脚本默认使用 Windows 上的 Edge。其他安装位置可用 `MIRAI_BROWSER` 指定 Chromium 可执行文件。`MIRAI_QA_PORT` 指定本地预览端口。头图只依赖同目录的图片，可以单独重新渲染。浏览器关闭后，临时配置保存在忽略的 `.tmp/` 下。

舞台样本使用项目现有的 Edge 回归与截图选项。平台导入样本使用隔离测试数据，更新时应保持勾选状态清晰。[浏览器回归入口](../../scripts/check-home-settings.mjs)

## English

The gallery shows the running app in an isolated Chromium session. Home and playlist detail use public catalog responses. Import selection and fullscreen lyric examples use test data, and the two settings images show the preview's default preferences. The bilingual hero images are local HTML layouts built from those screenshots. Use the commands above to refresh the live views and render the headers.
