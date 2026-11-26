# 界面素材

中英文 README 共用 Windows 桌面开发版实拍。GIF 使用许嵩《有何不可》的真实播放画面，截图保留账号推荐和已导入歌单，画面中的账号昵称与头像已遮挡。

| 素材                                                                                  | 内容                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------ |
| `home-playback.gif`                                                                   | 播放中的首页、底栏频谱和正在播放面板 |
| `fullscreen-lyrics.gif`                                                               | 时尚、手书、字幕、对话四种歌词舞台   |
| `feature-home.png`、`home.png`、`feature-library.png`                                 | 首页、首页内容近景和音乐库           |
| `feature-search.png`、`feature-playlist.png`、`feature-queue.png`                     | 搜索结果、歌单详情和播放队列         |
| `feature-platforms.png`、`feature-import.png`                                         | 平台连接、导入统计和歌单选择         |
| `feature-fashion.png`、`feature-ink.png`、`feature-subtitles.png`、`feature-chat.png` | 四款歌词舞台的静态截图               |
| `feature-equalizer.png`、`feature-desktop.png`                                        | 独立设置窗的音质和桌面选项           |
| `desktop-island.gif`                                                                  | 桌面指南中的灵动岛展开与收起演示     |

## 重新拍摄

在 Windows 上运行 `pnpm tauri dev`，使用已有歌单播放一首含同步歌词的曲目。录制时保留播放进度、频谱和歌词变化，静态截图在加载完成后采集。裁切到应用内容边界，主窗按 1360 × 860、独立设置窗按 860 × 740 保存。发布前逐帧核对，遮挡账号昵称、头像和其他可识别信息。

旧版双语头图可用 `node docs/images/capture.mjs --hero` 从首页和时尚舞台截图重新生成。

[中文 README](../../README.md) · [English README](../../README.en.md)
