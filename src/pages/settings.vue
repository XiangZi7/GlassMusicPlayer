<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
</script>

<template>
<!-- settings 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="settings">
      <div class="pg-head">
        <h3>设置</h3>
        <p>播放、音质与界面偏好 — 修改即时生效，A、B 两窗口同步。</p>
      </div>
      <div class="pg-secttl">播放 · PLAYBACK</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>无缝播放</b><span>上一首淡出与下一首淡入衔接，不留静音间隙</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="gapless"
            role="switch"
            aria-checked="true"
            aria-label="无缝播放"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>交叉淡化</b><span>切歌时用交叉淡化过渡，而不是硬切</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="crossfadeOn"
            role="switch"
            aria-checked="true"
            aria-label="交叉淡化"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>淡化时长</b
            ><span
              >交叉淡化持续的秒数 · 当前
              <span data-set-val="crossfade">6 秒</span></span
            >
          </div>
          <div class="set-slider">
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value="6"
              data-set-range="crossfade"
              aria-label="交叉淡化时长"
            />
          </div>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>音量标准化</b><span>把不同专辑的响度拉到同一水平</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="normalize"
            role="switch"
            aria-checked="false"
            aria-label="音量标准化"
            ><i></i
          ></BaseButton>
        </div>
      </div>
      <div class="pg-secttl">音质 · AUDIO</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>默认音质</b><span>播放时首选的规格</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="quality"
            hook="data-val"
            :options="[
              { label: '标准', value: '标准' },
              { label: 'FLAC 16', value: 'FLAC · 16-BIT' },
              { label: 'FLAC 24', value: 'FLAC · 24-BIT' },
              { label: 'DSD', value: 'DSD · 1-BIT' },
            ]"
          />
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>输出设备</b><span>当前输出走选定的设备</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="output"
            hook="data-val"
            :options="[
              { label: '桌面音箱', value: '桌面音箱' },
              { label: '耳机', value: '耳机' },
            ]"
          />
        </div>
      </div>
      <div class="pg-secttl">界面 · INTERFACE</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>玻璃质感</b
            ><span
              >整个窗口的材质风格 —
              选毛玻璃或液态玻璃会同时应用到两个窗口；选跟随窗口恢复 A 毛玻璃、B
              液态玻璃</span
            >
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="glassStyle"
            hook="data-val"
            :options="[
              { label: '跟随窗口', value: 'match' },
              { label: '毛玻璃', value: 'frosted' },
              { label: '液态玻璃', value: 'liquid' },
            ]"
          />
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>天气胶囊</b
            ><span>在顶栏与全屏页右上角显示本地天气 — 关掉这里会立刻隐藏</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="weather"
            role="switch"
            aria-checked="true"
            aria-label="天气胶囊"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>界面动效</b><span>天气图标漂移、全屏背景巨字缓漂等动态效果</span>
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="motion"
            role="switch"
            aria-checked="true"
            aria-label="界面动效"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>正在播放面板</b
            ><span
              >右侧大封面、歌词与播放队列面板 —
              关掉即收起，给中间列表腾出横向空间；也可以点主区与右栏接缝处的小箭头</span
            >
          </div>
          <BaseButton
            class="switch"
            data-np-switch
            role="switch"
            aria-checked="true"
            aria-label="正在播放面板"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>桌面歌词</b
            ><span
              >页面下方桌面区的悬浮歌词窗 —
              可拖动，字号与透明度在桌面区工具条里调</span
            >
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="deskLyrics"
            role="switch"
            aria-checked="true"
            aria-label="桌面歌词"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>桌面歌词锁定</b
            ><span
              >锁定后歌词窗点击穿透、不挡鼠标 — 在桌面区工具条或这里解锁</span
            >
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="deskLock"
            role="switch"
            aria-checked="false"
            aria-label="桌面歌词锁定"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>托盘迷你播放器</b
            ><span
              >桌面区任务栏右下角的 Aura 托盘图标 —
              关掉即隐藏，点开是迷你播放器</span
            >
          </div>
          <BaseButton
            class="switch"
            data-set-toggle="trayMini"
            role="switch"
            aria-checked="true"
            aria-label="托盘迷你播放器"
            ><i></i
          ></BaseButton>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>均衡器</b
            ><span>预设音效 — 影响播放的频段曲线（原型内切换状态）</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="eq"
            hook="data-val"
            :options="[
              { label: '原声', value: '原声' },
              { label: '流行', value: '流行' },
              { label: '低音', value: '低音' },
              { label: '人声', value: '人声' },
            ]"
          />
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>睡眠定时器</b><span>到时自动暂停播放</span>
          </div>
          <SlidingTabs
            kind="segment"
            class="set-seg"
            data-set-seg="sleep"
            hook="data-val"
            :options="[
              { label: '关闭', value: '关闭' },
              { label: '15 分钟', value: '15 分钟' },
              { label: '30 分钟', value: '30 分钟' },
              { label: '60 分钟', value: '60 分钟' },
            ]"
          />
        </div>
      </div>
      <div class="pg-secttl">快捷键 · SHORTCUTS</div>
      <div class="set-card">
        <div class="key-row">
          <div class="set-txt">
            <b>播放 / 暂停</b
            ><span
              >焦点在按钮上时空格仍用于触发按钮，在输入框里打字时不触发</span
            >
          </div>
          <kbd>空格</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>快退 5 秒</b></div>
          <kbd>←</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>快进 5 秒</b></div>
          <kbd>→</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>音量增大</b><span>每次 +5</span></div>
          <kbd>↑</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>音量减小</b><span>每次 −5</span></div>
          <kbd>↓</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt">
            <b>静音 / 恢复音量</b><span>恢复到静音前的音量</span>
          </div>
          <kbd>M</kbd>
        </div>
        <div class="key-row">
          <div class="set-txt"><b>关闭全屏播放 / 返回首页</b></div>
          <kbd>Esc</kbd>
        </div>
      </div>
      <div class="pg-secttl">关于 · ABOUT</div>
      <div class="set-card">
        <div class="set-row">
          <div class="set-txt">
            <b>Aura Player</b
            ><span
              >桌面端音乐播放器 — A · 传统毛玻璃与 B ·
              液态玻璃双方案设计原型</span
            >
          </div>
          <span class="about-val">DESKTOP</span>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>版本</b
            ><span>界面与交互原型，两个窗口共用同一套播放逻辑与状态</span>
          </div>
          <span class="about-val">v1.0.0</span>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>数据说明</b
            ><span
              >歌曲、歌词、封面与天气均为演示内容，不含真实音频；所有状态只保存在本页内，关掉即清空</span
            >
          </div>
          <span class="about-val">DEMO</span>
        </div>
        <div class="set-row">
          <div class="set-txt">
            <b>正式版技术栈</b
            ><span
              >规划为 Vue 3 + Tauri，平台对接与真实音频引擎在正式版接入</span
            >
          </div>
          <span class="about-val">PLANNED</span>
        </div>
      </div>
    </div>
</template>
