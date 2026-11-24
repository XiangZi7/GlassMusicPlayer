# Mirai Player 文档图片

中英文首页共用同一组播放中的桌面截图。顶图按语言分别排版，功能图保留 Windows 客户端原始中文界面。[中文首页](../../README.md) · [English](../../README.en.md)

## 拍摄内容

| 图片 | 画面 |
| --- | --- |
| `feature-home.png`、`home.png`（内容近景）、`feature-library.png` | 已关联账号的每日推荐、左侧导入歌单和本地音乐库 |
| `feature-search.png` | 搜索“学生会也有洞”，在结果和播放栏查看《ぴ》的片尾曲标注 |
| `feature-playlist.png`、`feature-queue.png` | Good music 歌单和播放中的队列 |
| `feature-fashion.png`、`feature-ink.png`、`feature-subtitles.png`、`feature-chat.png` | 同一首《ぴ》在时尚、手书、字幕、对话四款舞台中的封面和同步歌词 |
| `feature-platforms.png`、`feature-import.png` | 已关联平台、导入统计与歌单选择 |
| `feature-equalizer.png`、`feature-desktop.png` | 同一桌面会话打开的音质与桌面设置 |
| `miraiplayer-logo.png` | 粉发眼镜少女与播放符号，透明 PNG 母图 |
| `showcase-hero-zh.png`、`showcase-hero-en.png` | 1600 × 800 的双语头图，由首页和时尚舞台实拍排版生成 |

## 更新素材

1. 在 Windows 上运行 `pnpm tauri dev`，打开已关联的平台账号和已导入的音乐库。在歌单或搜索结果点播一首有封面、同步歌词和作品说明的歌曲，等待进度开始移动。
2. 截取应用内容边界，主窗按 1360 × 860 逻辑像素、独立设置窗按 860 × 740 逻辑像素保存。保持同一曲目、材质和界面缩放。任选歌单只用于展示选择状态，完成后关闭弹窗。发布前核对画面中的账号信息适合公开展示。
3. 将截图保存为上表对应的文件。运行 `node docs/images/capture.mjs --hero` 重新排版两种语言的头图。脚本默认使用 Windows 上的 Edge，可用环境变量 `MIRAI_BROWSER` 指定其他 Chromium 可执行文件。

本组截图来自正常启动的 Tauri 原生开发版。拍摄时使用已登录的桌面账号、现有曲库和真实播放。公开搜索及曲目详情由本地运行的 MiraiMusic-Server 更新版读取来源平台，播放授权和歌词沿用播放器原有服务。

## English

The gallery follows one signed-in desktop session while **ぴ** by Nanawo Akari is playing. The screenshots show the account’s daily recommendations, imported library, search results, playback queue and all four lyric stages. Search and song details used the updated local catalog service with live provider responses. The two headers are composed from the same captures and the transparent app icon.
