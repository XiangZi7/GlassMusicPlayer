# 播放、长列表与窗口性能

## 验证哪些行为

| 场景 | 实现 | 检查重点 |
| --- | --- | --- |
| 长播放队列 | 以 53px 行高和额外可视行做虚拟化 | 700 首以上仍可到末首，拖动与高亮使用真实队列位置 |
| 长篇歌词 | 少于 96 行使用普通文档流，其余按每组 16 行挂载与估算高度 | 跳到后半段、切换翻译、阅读或拖动时当前行和键盘焦点可恢复 |
| 连续切歌 | 取消旧动画和旧请求，保留新选择 | 快速切换、播放后立刻暂停、关闭全屏时旧回调不会重新打开页面 |
| 封面和频谱 | 列表封面延迟加载、异步解码；频谱消费真实音频分析结果 | 暂停、空曲库或不支持分析时状态准确 |
| 原生表面 | 设置和小窗隔离，按范围执行窗口与存储命令 | 同一控件在毛玻璃、液态玻璃、不同 DPI 与窄窗口下可用 |

这些是实现参数与检查场景。帧率、内存占用与启动耗时要在指定硬件和相同曲单上测量。[队列实现](../src/components/player/QueueList.vue) · [歌词窗口](../src/services/player/lyric-window.js)

## 可重复运行的检查

```sh
pnpm check:motion
pnpm check:fullscreen
pnpm check:queue-menu
pnpm check:spectrum
pnpm check:equalizer
pnpm check:native
```

动效检查读取原稿语义摘要，覆盖 12 组全屏切歌动画、9 组桌面切歌动画、14 组 CSS 关键帧及 15 个输入处理器。仓库根目录的本机设计稿不参与编译或这些检查。源码摘要中的原稿 blob ID 用于追溯比较来源。[动效基准](../scripts/motion-baseline.json)

## 在浏览器中复现

先启动本机 Vite 服务，再在 Windows 的另一终端运行浏览器回归。脚本创建单独的 Edge 配置，并用测试曲目和受控响应重复同一场景。

```sh
pnpm check:player-ui
pnpm check:stage-performance
node scripts/check-home-settings.mjs --discovery-playlists
node scripts/check-home-settings.mjs --about
```

默认连接 `127.0.0.1:1420`。已有服务使用其他端口时，设置 `MIRAI_QA_PORT`。歌单与加载专项需要开发模式提供的模块地址。对照两个材质时使用相同窗口大小、滚动位置和封面；测试加载或取消时分别观察内容区、播放按钮及焦点。

## 原生验收

Rust 单元测试覆盖窗口几何、托盘状态以及存储输入校验。操作系统的真实行为还要打开桌面包验证，例如 Windows 10 阴影透明区、多个显示器的工作区边缘、从托盘恢复、在本机输出设备上试听 EQ。记录动态效果设置、系统缩放与曲目标识，才能在另一台机器上复现。[开发文档](DEVELOPMENT.md) · [桌面操作](desktop.md)
