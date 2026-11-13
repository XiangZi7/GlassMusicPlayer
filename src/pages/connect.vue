<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
</script>

<template>
<!-- connect 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="connect">
      <div class="pg-head">
        <h3>平台对接</h3>
        <p>
          把你在其他平台的歌单、喜欢和收藏搬进来 —
          连接后可勾选要导入的歌单，导入的歌单会出现在左侧「我的歌单」下方，两窗口同步。本页为设计原型：连接与导入在本页内演示，不会真的登录你的第三方账号；正式版需各平台开放平台授权（OAuth）后接入。
        </p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="内容导入分类"
        hook="data-src-tab"
        :options="[
          { label: '平台对接', value: 'connect' },
          { label: '上传歌曲', value: 'upload' },
          { label: '下载管理', value: 'downloads' },
        ]"
      />
      <div class="lib-stats">
        <div><b data-stat-conn>0 / 3</b><span>已连接平台</span></div>
        <div><b data-stat-imp>0</b><span>已导入歌单</span></div>
        <div><b data-stat-impsongs>0</b><span>导入歌曲（演示）</span></div>
        <div><b data-stat-sync>—</b><span>最近同步</span></div>
      </div>
      <div class="plat-grid">
        <div class="plat-card" data-plat-card="netease">
          <div class="plat-top">
            <div class="plat-logo ne">云</div>
            <div><b>网易云音乐</b><span>歌单 · 我喜欢 · 每日推荐</span></div>
            <span class="plat-status" data-plat-status>未连接</span>
          </div>
          <p>同步你的网易云歌单与红心歌曲，封面、歌词与播放记录一并对齐。</p>
          <div class="plat-meta">
            <span>歌单 12</span><span>喜欢 486 首</span><span>等级 LV.8</span>
          </div>
          <BaseButton class="plat-btn" data-conn-btn="netease"
            >连接网易云</BaseButton
          >
          <div class="plat-detail">
            <div class="set-row">
              <div class="set-txt">
                <b>自动同步新歌单</b
                ><span>在网易云新建的歌单自动出现在这里</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="neaseAuto"
                role="switch"
                aria-checked="true"
                aria-label="网易云自动同步"
                ><i></i
              ></BaseButton>
            </div>
            <div class="set-row">
              <div class="set-txt">
                <b>同步「我喜欢」</b><span>红心歌曲合并进「我喜欢的」</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="neaseLiked"
                role="switch"
                aria-checked="true"
                aria-label="网易云同步喜欢"
                ><i></i
              ></BaseButton>
            </div>
          </div>
        </div>
        <div class="plat-card" data-plat-card="kugou">
          <div class="plat-top">
            <div class="plat-logo kg">狗</div>
            <div><b>酷狗音乐</b><span>歌单 · 收藏 · 本地歌曲</span></div>
            <span class="plat-status" data-plat-status>未连接</span>
          </div>
          <p>导入酷狗的自建歌单与收藏夹，蝰蛇音效等平台专属设置不迁移。</p>
          <div class="plat-meta">
            <span>歌单 6</span><span>收藏 213 首</span><span>本地 58 首</span>
          </div>
          <BaseButton class="plat-btn" data-conn-btn="kugou"
            >连接酷狗</BaseButton
          >
          <div class="plat-detail">
            <div class="set-row">
              <div class="set-txt">
                <b>自动同步新歌单</b><span>在酷狗新建的歌单自动出现在这里</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="kgAuto"
                role="switch"
                aria-checked="true"
                aria-label="酷狗自动同步"
                ><i></i
              ></BaseButton>
            </div>
            <div class="set-row">
              <div class="set-txt">
                <b>同步收藏夹</b><span>收藏歌曲合并进音乐库</span>
              </div>
              <BaseButton
                class="switch"
                data-src-toggle="kgFav"
                role="switch"
                aria-checked="false"
                aria-label="酷狗同步收藏"
                ><i></i
              ></BaseButton>
            </div>
          </div>
        </div>
        <div class="plat-card" data-plat-card="kuwo">
          <div class="plat-top">
            <div class="plat-logo kw">我</div>
            <div><b>酷我音乐</b><span>歌单 · 无损专辑 · 电台</span></div>
            <span class="plat-status" data-plat-status>未连接</span>
          </div>
          <p>导入酷我歌单与已购无损专辑清单，方便和本地 FLAC 库对照去重。</p>
          <div class="plat-meta">
            <span>歌单 4</span><span>已购专辑 9</span><span>无损 121 首</span>
          </div>
          <BaseButton class="plat-btn" data-conn-btn="kuwo"
            >连接酷我</BaseButton
          >
          <div class="plat-detail">
            <div class="set-row">
              <div class="set-txt">
                <b>自动同步新歌单</b><span>在酷我新建的歌单自动出现在这里</span>
              </div>
              <BaseButton
                class="switch"
                data-src-toggle="kwAuto"
                role="switch"
                aria-checked="false"
                aria-label="酷我自动同步"
                ><i></i
              ></BaseButton>
            </div>
            <div class="set-row">
              <div class="set-txt">
                <b>同步已购专辑</b><span>已购无损专辑出现在专辑页</span>
              </div>
              <BaseButton
                class="switch on"
                data-src-toggle="kwBuy"
                role="switch"
                aria-checked="true"
                aria-label="酷我同步已购"
                ><i></i
              ></BaseButton>
            </div>
          </div>
        </div>
      </div>
      <div class="pg-secttl">
        选择要导入的歌单 · <span data-imp-picked>已选 0</span>
      </div>
      <div data-imp-list></div>
      <div class="pl-actions" style="margin-top: 6px">
        <BaseButton class="banner-play" data-import-go>导入所选歌单</BaseButton
        ><span data-imp-status>先连接任意平台，再勾选歌单导入</span>
      </div>
      <div class="pg-secttl">用链接导入 · 粘贴歌单分享链接</div>
      <div class="link-row">
        <input
          type="text"
          data-link-input
          placeholder="粘贴网易云 / 酷狗 / 酷我歌单链接，例如 music.163.com/playlist?id=…"
          aria-label="歌单分享链接"
        /><BaseButton class="up-add" data-link-parse>解析</BaseButton>
      </div>
      <div class="src-note" data-link-result></div>
      <div class="imp-row" style="margin-top: 16px">
        <span class="it"
          ><b>功能全景</b
          ><span>已有功能 · 本轮新增 · 正式版缺口，一页看清</span></span
        ><BaseButton class="imp-pick" data-goto="hub">查看</BaseButton>
      </div>
      <p class="src-note">
        版权说明：平台曲库歌曲受各平台版权与会员规则限制，导入的是歌单结构与元数据；正式版中，能否直接播放取决于对应平台的授权与你的会员状态，无版权歌曲会标注并给出本地文件匹配建议。
      </p>
    </div>
</template>
