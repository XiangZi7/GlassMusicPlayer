<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <section class="section" id="deskSection">
    <h2>桌面层 · 桌面包三件套</h2>
    <p class="sub">
      下面是一块模拟的系统桌面：桌面歌词悬浮窗常驻在壁纸上（拖它的标题条可以挪位置），右下角任务栏里有
      Aura 托盘图标，点开是迷你播放器；系统媒体控制卡从窗口侧边栏「桌面独有 ·
      系统媒体控制」打开。三处都和上面两个窗口共用同一套播放状态 —
      播放、切歌、进度、音量全部同步。<b>切歌时三处都有动画</b>，和全屏舞台同一套语言：旧封面残影滑出淡去、新封面同帧滑入落位（方向跟随上一首
      /
      下一首），歌名与歌手错峰跟上，桌面歌词的三行歌词像全屏歌词列一样顺次漂入、播放键轻轻落定，任务栏托盘图标也会弹一下；连按切歌不会叠影，关界面动效或系统要求减少动态时全部静止。光扫仍只属于全屏大封面，这三处不做。
    </p>
    <div class="desk-tools">
      <BaseButton type="button" data-desk-act="lyr"
        >桌面歌词 开 / 关</BaseButton
      >
      <BaseButton type="button" data-desk-act="lock">锁定点击穿透</BaseButton>
      <span class="desk-tools-lab">字号</span>
      <BaseButton type="button" data-desk-act="font-">A−</BaseButton>
      <BaseButton type="button" data-desk-act="font+">A+</BaseButton>
      <span class="desk-tools-lab">透明度</span>
      <input
        type="range"
        id="deskOpacity"
        min="35"
        max="100"
        value="94"
        aria-label="桌面歌词透明度"
      />
    </div>
    <div class="desk" id="desk">
      <div class="desk-lyr" id="deskLyr">
        <div class="desk-lyr-head" id="deskLyrHead">
          <span aria-hidden="true">⠿</span><span>桌面歌词 · AURA</span
          ><span class="desk-lyr-state" id="deskLyrState">可拖动</span>
        </div>
        <div class="desk-lyr-prev" data-desk-prev></div>
        <div class="desk-lyr-cur" data-desk-cur></div>
        <div class="desk-lyr-next" data-desk-next></div>
        <div class="desk-lyr-prog"><i data-desk-prog></i></div>
        <div class="desk-lyr-meta">
          <span data-desk-title></span><span data-desk-time></span>
        </div>
      </div>
      <div class="desk-smtc" id="deskSmtc" hidden>
        <span class="smtc-tag">系统媒体控制 · SMTC</span>
        <img data-desk-cover alt="专辑封面" />
        <div class="smtc-txt">
          <b data-desk-title></b><span data-desk-artist></span>
          <div class="smtc-prog"><i data-desk-prog></i></div>
        </div>
        <div class="smtc-btns">
          <BaseButton type="button" data-desk-prev-btn aria-label="上一首"
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg></BaseButton
          ><BaseButton
            type="button"
            data-desk-play
            aria-label="播放或暂停"
          ></BaseButton
          ><BaseButton type="button" data-desk-next-btn aria-label="下一首"
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
          ></BaseButton>
        </div>
      </div>
      <div class="desk-wm">AURA DESKTOP · 原型桌面</div>
      <div class="tray-pop" id="trayPop" hidden>
        <div class="tray-pop-head">
          <span>正在播放 · AURA PLAYER</span
          ><BaseButton type="button" data-desk-open>打开主窗口</BaseButton>
        </div>
        <div class="tray-pop-main">
          <img data-desk-cover alt="专辑封面" />
          <div class="tray-pop-txt">
            <b data-desk-title></b><span data-desk-artist></span>
          </div>
          <BaseButton class="heart" data-desk-like aria-label="收藏"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5 5 7.6 5c1.7 0 3.4 1 4.4 2.6C13 6 14.7 5 16.4 5 19 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8z"
              /></svg
          ></BaseButton>
        </div>
        <div class="tray-prog" data-desk-seekbar><i data-desk-prog></i></div>
        <div class="tray-pop-ctl">
          <BaseButton type="button" data-desk-prev-btn aria-label="上一首"
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg
          ></BaseButton>
          <BaseButton
            type="button"
            class="tray-play"
            data-desk-play
            aria-label="播放或暂停"
          ></BaseButton>
          <BaseButton type="button" data-desk-next-btn aria-label="下一首"
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
          ></BaseButton>
          <input
            type="range"
            class="vol tray-vol"
            id="trayVol"
            min="0"
            max="100"
            value="70"
            aria-label="音量"
            style="--p: 70%"
          />
        </div>
      </div>
      <div class="taskbar">
        <div class="tb-apps">
          <span class="tb-app on">♪</span><span class="tb-app">▦</span
          ><span class="tb-app">◐</span>
        </div>
        <div class="tb-tray">
          <BaseButton
            class="tray-btn"
            id="trayBtn"
            type="button"
            aria-label="Aura Player 托盘图标 — 点击打开迷你播放器"
            title="Aura Player · 托盘迷你播放器"
            ><span class="tray-eq"><i></i><i></i><i></i></span
          ></BaseButton>
          <span class="tb-clock" id="tbClock">--:--</span>
        </div>
      </div>
    </div>
    <p class="sub" style="margin-top: 12px">
      正式版（Tauri）里：桌面歌词是独立的置顶小窗、迷你播放器挂在系统托盘、键盘媒体键与任务栏缩略图控制走系统
      SMTC / MPRIS 接口 — 原型里三处 UI
      都已就位且可操作，接入系统层是正式开发阶段的工作。
    </p>
  </section>
</template>
