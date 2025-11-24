🎵 **提示：** 旧项目已迁移至分支 👇
[GlassMusicPlayer/GlassMusicPlayer-V1 分支](https://github.com/XiangZi7/GlassMusicPlayer/tree/GlassMusicPlayer-V1)
[GlassMusicPlayer/kmmusic 分支](https://github.com/XiangZi7/GlassMusicPlayer/tree/kmmusic)

# Glass Music Player

![alt text](images/image.png)

### 介绍 📖

**Glass Music Player** 是一款基于
**Vue3.5**、**Vite5**、**Pinia**、**Tailwindcss** 和 **Element-Plus**
开发的开源 Web 音乐播放器。它采用目前最新的技术栈，提供流畅且美观的音乐播放体验。

### 系统需求 ⚙️

- **Node.js** 版本需大于 **18**。

### 在线预览 👀

- [Netlify 预览](https://topm.netlify.app)

### 代码仓库 ⭐

[GitHub 代码仓库](https://github.com/XiangZi7/KM-Music-Player)

### 项目功能 🔨

- 主题与视觉
  - 浅/暗双主题重构：使用 `:root` CSS 变量与 `html.dark`，提升全站一致性
  - 背景主题：新增 Ultimate 背景（可配置），Aurora/ColorBends/Ultimate 三选一
  - 设置页新增背景主题面板与主题模式切换
- 主页与列表
  - 推荐歌单卡片统一尺寸，支持左右箭头翻页，首屏仅显示右箭头
  - GlassSelect 下拉重构：玻璃质感、暗黑适配、可读性增强
  - 分页组件抽象（Pagination）：搜索与评论弹窗共用
  - 播放列表气泡（PlaylistBubble）：拖拽排序、下一首播放、批量删除、图标化操作
- 搜索与骨架
  - 搜索下拉联想：按接口 `result.order` 展示 songs/playlists，点击歌曲直接搜索，歌单直达详情
  - 歌单/MV 列表加载骨架，组件内请求也能正常显示（覆盖层方式）
- 详情与发现
  - 歌曲详情页：歌词全文、相似歌曲/相似歌单、评论弹窗
  - 歌手页：头像与信息英雄区、热门歌曲、专辑列表、播放热门/随机播放
  - 专辑页：封面英雄区、发行信息、简介折叠、曲目列表、播放/随机播放
  - 排行榜页：`topSong` 多类型切换（全部/华语/欧美/日本/韩国）
- 交互与导航
  - 侧边栏分组：探索/我的音乐/系统，入口更清晰
  - 顶部导航外链：项目仓库与影视站直达
- 评论与歌词
  - 评论弹窗：分页、IP归属与时间、楼中楼显示
  - 底部歌词：设置可选显示原文/译文/罗马音（最多两行）

### 安装使用步骤 📔

- Clone

# Github

使用 Git 克隆项目到本地：

```bash
git clone https://github.com/XiangZi7/GlassMusicPlayer.git
```

安装依赖

进入项目目录并安装所需的依赖：

```bash
cd GlassMusicPlayer
pnpm install
```

修改.env的VITE_APP_BASE_API

```
# 本地环境接口地址
VITE_APP_BASE_API = '你的网易云接口地址'
```

启动开发服务器

启动本地开发服务器，为你提供实时预览：

```bash
pnpm dev
```

文档说明

你可以查阅 [网易云音乐 API 文档](https://neteasecloudmusicapi.vercel.app/#/)
以获取更多信息和接口使用说明（可能需要魔法上网）。

### 项目截图 📷

![项目截图 0](images/image.png)

![项目截图 1](images/image-1.png)

![项目截图 2](images/image-2.png)

![项目截图 17](images/image-18.png)

![项目截图 17](images/image-19.png)

![项目截图 17](images/image-20.png)

![项目截图 17](images/image-21.png)

![项目截图 3](images/image-3.png)

![项目截图 4](images/image-4.png)

![项目截图 5](images/image-5.png)

![项目截图 6](images/image-6.png)

![项目截图 7](images/image-7.png)

![项目截图 8](images/image-8.png)

![项目截图 9](images/image-9.png)

![项目截图 10](images/image-10.png)

![项目截图 11](images/image-11.png)

![项目截图 12](images/image-12.png)

![项目截图 13](images/image-13.png)

![项目截图 14](images/image-14.png)

![项目截图 15](images/image-15.png)

![项目截图 16](images/image-16.png)

![项目截图 17](images/image-17.png)


### 项目后台接口 🧩

- [https://neteasecloudmusicapi.vercel.app/#/](https://neteasecloudmusicapi.vercel.app/#/)
  （可能需魔法上网）

### 免责声明 ⚠️

KMMusicPlayer（Kuriyama Mirai Music
Player）项目仅用于学习和研究目的。使用该项目的用户需自行承担相关风险。本项目所使用的相关API和数据源均为第三方提供，使用时请遵循相关法律法规及第三方的使用条款。本项目不得用于任何商业目的，我们不对任何由于使用本项目而引起的直接或间接的损失或法律责任负责。

请在使用之前仔细阅读该免责声明，并确保遵守以上条款。谢谢您的理解与支持。

### QQ交流群 👨‍👨‍👦‍👦

![1686722147442.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2ef2a97c45df4a6fa5c78b34a28a42fc~tplv-k3u1fbpfcp-watermark.image#?w=238&h=250&s=10821&e=png&a=1&b=f8f8f8)

### 捐赠 （❤

如果觉得该项目能对你有帮助或喜欢可投食 | 微信 | 支付宝 | |
:--------------------------------------------------------------------------------:
|
:--------------------------------------------------------------------------------:
| |
<img src="https://github.com/user-attachments/assets/46d07565-72b9-4d48-bea2-4a7242e5ada0" alt="Alipay QRcode" width=170>
|
<img src="https://github.com/user-attachments/assets/7c3e1e96-cfc3-460d-b534-8a1da636cc09" alt="Wechat QRcode" width=170>
|

### GitHub Star 趋势

[![Stargazers over time](https://starchart.cc/XiangZi7/KM-Music-Player.svg?variant=adaptive)](https://starchart.cc/XiangZi7/KM-Music-Player)

### 常见问题 (FAQ) ❓

- 如何解决启动错误？

请确保你的 Node.js 版本满足要求，并检查安装依赖时的错误信息。

- 播放器如何更改主题？

在侧边菜单栏中选择“主题”选项，然后你可以选择不同的主题风格。
