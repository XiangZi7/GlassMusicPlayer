<script setup lang="ts"></script>

<template>
  <!-- hub 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="hub"
  >
    <!-- 页头波普点缀：半调层与星星贴纸绝对定位覆盖，正文结构不动。 -->
    <div class="pg-head hub-pop-head">
      <span class="hub-pop-dots pop-halftone" aria-hidden="true" />
      <h3>功能全景</h3>
      <p>这个播放器现在有什么、这一轮补了什么、正式版还差什么 — 一页看清。</p>
      <span class="hub-star pop-sticker" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path class="sticker-halo" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
          <path class="sticker-star" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
        </svg>
      </span>
    </div>
    <div class="audit-grid mt-4 grid grid-cols-[repeat(3,1fr)] gap-3">
      <div
        class="audit-col rounded-2xl border border-transparent p-[14px_15px]"
      >
        <h6>已经能用的</h6>
        <ul>
          <li>播放 / 暂停 / 切歌 / 拖进度</li>
          <li>音量三态图标 + 点喇叭静音恢复</li>
          <li>随机、三态循环、播放队列</li>
          <li>全屏播放页 + 双层 Dock</li>
          <li>歌词滚动高亮、悬浮歌词胶囊</li>
          <li>首页 / 搜索 / 音乐库 / 专辑 / 歌手</li>
          <li>歌单详情、我喜欢的、最近播放</li>
          <li>设置：玻璃质感、天气、音质、输出</li>
          <li>迷你播放器、悬浮歌词窗、系统媒体控制（桌面）</li>
          <li>键盘快捷键（空格 / 方向键 / M）</li>
        </ul>
      </div>
      <div
        class="audit-col rounded-2xl border border-transparent p-[14px_15px]"
      >
        <h6>这一轮新补的</h6>
        <ul>
          <li>歌曲电台：以当前歌为种子自动续播</li>
          <li>智能歌单：从当前曲库随机重温</li>
          <li>播放队列拖拽排序 + 下一首播放</li>
          <li>桌面歌词悬浮窗（拖动 / 锁定穿透 / 字号透明度）</li>
          <li>托盘迷你播放器（页面下方桌面区）</li>
          <li>系统媒体控制 UI 位（页面下方桌面区）</li>
          <li>右侧正在播放面板可折叠（接缝箭头 / 设置开关）</li>
          <li>标签条、分页、排序与设置分段控件改滑动胶囊高亮</li>
          <li>网易云、酷狗、酷我公开曲库搜索</li>
          <li>公开歌单链接导入，曲目保存到侧边栏</li>
          <li>点歌时读取平台提供的音频与歌词</li>
          <li>本地曲目资料登记：文件选择、拖放或手动填写</li>
          <li>新建歌单（侧边栏「我的歌单」）</li>
          <li>下载管理页：队列暂停 / 继续</li>
          <li>均衡器预设 + 睡眠定时器（设置）</li>
          <li>本页：功能全景与缺口清单</li>
          <li>侧边栏收纳：曲库 / 内容导入标签页</li>
          <li>平台卡改横排整行版式</li>
          <li>文件登记支持选择整个文件夹</li>
          <li>长列表全站分页 · 每页 10 首</li>
          <li>列表排序：默认 / 歌名 / 歌手 / 时长</li>
          <li>最近播放一键清空</li>
          <li>设置：快捷键一览 + 关于 / 版本</li>
          <li>自建歌单行内重命名 + 删除确认</li>
        </ul>
      </div>
      <div
        class="audit-col rounded-2xl border border-transparent p-[14px_15px]"
      >
        <h6>正式版还需要的</h6>
        <ul>
          <li>三方平台官方授权登录（OAuth）</li>
          <li>本地音频文件导入与文件夹扫描</li>
          <li>账号体系与多设备云同步</li>
          <li>版权曲库与会员音质的授权校验</li>
          <li>离线缓存加密与下载断点续传</li>
          <li>歌词 / 封面自动匹配与纠错</li>
          <li>评论、分享与关注歌手动态</li>
          <li>排行榜、每日推荐的真实数据源</li>
          <li>CarPlay / 车载与多房间输出</li>
          <li>数据备份、导入导出与隐私设置</li>
          <li>听歌统计与年度报告</li>
          <li>歌词翻译与发音对照显示</li>
          <li>歌曲信息编辑（标签 / 封面 / 歌词）</li>
          <li>播客、电台与有声内容频道</li>
          <li>多设备播放接力与远程控制</li>
          <li>重复歌曲检测与曲库智能整理</li>
        </ul>
      </div>
    </div>
    <p class="src-note mt-3 text-[11.5px] leading-[1.65] opacity-[.55]">
      公开歌单保存在本机。在线曲目能否播放取决于平台本次返回的音频。
    </p>
  </div>
</template>

<style scoped>
/* 页头半调点阵：与歌手详情页同一配方（点阵色 9%、同尺寸），只铺页头带。 */
.hub-pop-head { position: relative; }
.hub-pop-dots {
  position: absolute;
  inset: -6px -10px;
  --pop-halftone-color: rgb(255 255 255 / 9%);
}
.hub-pop-head > :not(.hub-pop-dots):not(.hub-star) { position: relative; }
/* 标题星星贴纸：与首页榜单同一星形配方，压在页头带右上角，不占正文流。 */
.hub-star {
  position: absolute;
  top: 0;
  right: 6px;
  width: 22px;
  height: 22px;
}
.hub-star svg { display: block; width: 100%; height: 100%; }
.hub-star .sticker-halo { fill: #fff; }
.hub-star .sticker-star {
  fill: var(--pop-yellow);
  stroke: var(--pop-ink);
  stroke-width: 1.4;
  transform: scale(0.76);
  transform-origin: center;
}
</style>
