<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { toRefs } from 'vue'
import { usePlayer } from '@/composables/usePlayer'
import type { SettingsSection } from '@/types/settings'

defineProps<{ section: SettingsSection }>()
const { state, setSetting, setNowPlaying } = usePlayer()
const { settings, npOpen } = toRefs(state)
// 淡化滑块更新当前设置草稿，由底栏的应用或保存统一提交。
function updateCrossfade(event: Event): void {
  setSetting('crossfade', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <!-- 设置内容组件：原有卡片、开关与滑动标签的视觉和动画保持不变。 -->
  <div
    class="space-y-[22px]"
    data-panel="settings"
  >
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'general'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          播放 · PLAYBACK
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>无缝播放</b
              ><span>上一首淡出与下一首淡入衔接，不留静音间隙</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.gapless }"
              role="switch"
              :aria-checked="settings.gapless"
              @click="setSetting('gapless', !settings.gapless)"
              aria-label="无缝播放"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>交叉淡化</b><span>切歌时用交叉淡化过渡，而不是硬切</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.crossfadeOn }"
              role="switch"
              :aria-checked="settings.crossfadeOn"
              @click="setSetting('crossfadeOn', !settings.crossfadeOn)"
              aria-label="交叉淡化"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>淡化时长</b
              ><span
                >交叉淡化持续的秒数 · 当前
                <span>{{ settings.crossfade }} 秒</span></span
              >
            </div>
            <div class="set-slider w-[172px] flex-none">
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                :value="settings.crossfade"
                :style="{ '--p': (settings.crossfade / 12) * 100 + '%' }"
                @input="updateCrossfade"
                aria-label="交叉淡化时长"
              />
            </div>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>音量标准化</b><span>把不同专辑的响度拉到同一水平</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.normalize }"
              role="switch"
              :aria-checked="settings.normalize"
              @click="setSetting('normalize', !settings.normalize)"
              aria-label="音量标准化"
              ><i></i
            ></BaseButton>
          </div>
        </div>
      </section>
      <section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          睡眠定时器
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>睡眠定时器</b><span>到时自动暂停播放</span>
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="sleep"
              hook="data-set-seg"
              :options="[
                { label: '关闭', value: '关闭' },
                { label: '15 分钟', value: '15 分钟' },
                { label: '30 分钟', value: '30 分钟' },
                { label: '60 分钟', value: '60 分钟' },
              ]"
            />
          </div>
        </div></section
    ></template>
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'audio'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          音质与输出 · AUDIO
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>默认音质</b><span>播放时首选的规格</span>
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="quality"
              hook="data-set-seg"
              :options="[
                { label: '标准', value: '标准' },
                { label: 'FLAC 16', value: 'FLAC · 16-BIT' },
                { label: 'FLAC 24', value: 'FLAC · 24-BIT' },
                { label: 'DSD', value: 'DSD · 1-BIT' },
              ]"
            />
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>输出设备</b><span>当前输出走选定的设备</span>
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="output"
              hook="data-set-seg"
              :options="[
                { label: '桌面音箱', value: '桌面音箱' },
                { label: '耳机', value: '耳机' },
              ]"
            />
          </div>
        </div>
      </section>
      <section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          音效
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>均衡器</b
              ><span>预设音效 — 影响播放的频段曲线（原型内切换状态）</span>
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="eq"
              hook="data-set-seg"
              :options="[
                { label: '原声', value: '原声' },
                { label: '流行', value: '流行' },
                { label: '低音', value: '低音' },
                { label: '人声', value: '人声' },
              ]"
            />
          </div>
        </div></section
    ></template>
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'appearance'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          界面 · INTERFACE
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>玻璃质感</b
              ><span
                >整个窗口的材质风格 —
                沿用播放器的毛玻璃或液态玻璃材质，应用后同步到主窗口</span
              >
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="glassStyle"
              hook="data-set-seg"
              :options="[
                { label: '跟随窗口', value: 'match' },
                { label: '毛玻璃', value: 'frosted' },
                { label: '液态玻璃', value: 'liquid' },
              ]"
            />
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>天气胶囊</b><span>在顶栏与全屏页右上角显示本地天气</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.weather }"
              role="switch"
              :aria-checked="settings.weather"
              @click="setSetting('weather', !settings.weather)"
              aria-label="天气胶囊"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>界面动效</b
              ><span>天气图标漂移、全屏背景巨字缓漂等动态效果</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.motion }"
              role="switch"
              :aria-checked="settings.motion"
              @click="setSetting('motion', !settings.motion)"
              aria-label="界面动效"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>正在播放面板</b
              ><span
                >右侧大封面、歌词与播放队列面板 —
                关掉即收起，给中间列表腾出横向空间；也可以点主区与右栏接缝处的小箭头</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: npOpen }"
              role="switch"
              :aria-checked="npOpen"
              @click="setNowPlaying(!npOpen)"
              aria-label="正在播放面板"
              ><i></i
            ></BaseButton>
          </div>
        </div></section
    ></template>
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'desktop'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          桌面窗口 · DESKTOP
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <!-- 灵动岛设置：启用歌词胶囊后可切换到桌面显示。 -->
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-0 flex-1">
              <b>灵动岛</b><span>显示当前歌词，按住胶囊可拖动</span>
            </div>
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.lyricIsland }"
              role="switch"
              :aria-checked="settings.lyricIsland"
              aria-label="灵动岛"
              @click="setSetting('lyricIsland', !settings.lyricIsland)"
              ><i
            /></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-0 flex-1">
              <b>在桌面显示灵动岛</b
              ><span>使用置顶小窗，播放器最小化后也可显示</span>
            </div>
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0 disabled:opacity-50"
              :class="{ on: settings.lyricIslandDesktop }"
              role="switch"
              :aria-checked="settings.lyricIslandDesktop"
              :disabled="!settings.lyricIsland"
              aria-label="在桌面显示灵动岛"
              @click="
                setSetting('lyricIslandDesktop', !settings.lyricIslandDesktop)
              "
              ><i
            /></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>桌面歌词</b
              ><span
                >页面下方桌面区的悬浮歌词窗 —
                可拖动，字号与透明度在桌面区工具条里调</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.deskLyrics }"
              role="switch"
              :aria-checked="settings.deskLyrics"
              @click="setSetting('deskLyrics', !settings.deskLyrics)"
              aria-label="桌面歌词"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>桌面歌词锁定</b
              ><span
                >锁定后歌词窗点击穿透、不挡鼠标 — 在桌面区工具条或这里解锁</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.deskLock }"
              role="switch"
              :aria-checked="settings.deskLock"
              @click="setSetting('deskLock', !settings.deskLock)"
              aria-label="桌面歌词锁定"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>托盘迷你播放器</b
              ><span
                >桌面区任务栏右下角的 Aura 托盘图标 —
                关掉即隐藏，点开是迷你播放器</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.trayMini }"
              role="switch"
              :aria-checked="settings.trayMini"
              @click="setSetting('trayMini', !settings.trayMini)"
              aria-label="托盘迷你播放器"
              ><i></i
            ></BaseButton>
          </div>
        </div></section
    ></template>
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'shortcuts'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          快捷键 · SHORTCUTS
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>播放 / 暂停</b
              ><span
                >焦点在按钮上时空格仍用于触发按钮，在输入框里打字时不触发</span
              >
            </div>
            <kbd>空格</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1"><b>快退 5 秒</b></div>
            <kbd>←</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1"><b>快进 5 秒</b></div>
            <kbd>→</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>音量增大</b><span>每次 +5</span>
            </div>
            <kbd>↑</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>音量减小</b><span>每次 −5</span>
            </div>
            <kbd>↓</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>静音 / 恢复音量</b><span>恢复到静音前的音量</span>
            </div>
            <kbd>M</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>关闭全屏播放 / 返回首页</b>
            </div>
            <kbd>Esc</kbd>
          </div>
        </div>
      </section></template
    >
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'about'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          关于 · ABOUT
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>Aura Player</b
              ><span
                >桌面端音乐播放器 — A · 传统毛玻璃与 B ·
                液态玻璃双方案设计原型</span
              >
            </div>
            <span
              class="about-val flex-none text-right font-mono text-[11.5px] font-bold opacity-[.72]"
              >DESKTOP</span
            >
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>版本</b
              ><span>界面与交互原型，两个窗口共用同一套播放逻辑与状态</span>
            </div>
            <span
              class="about-val flex-none text-right font-mono text-[11.5px] font-bold opacity-[.72]"
              >v1.0.0</span
            >
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>数据说明</b
              ><span
                >歌曲、歌词、封面与天气均为演示内容，不含真实音频；所有状态只保存在本页内，关掉即清空</span
              >
            </div>
            <span
              class="about-val flex-none text-right font-mono text-[11.5px] font-bold opacity-[.72]"
              >DEMO</span
            >
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>技术栈</b><span>Vue 3 + Tauri，在线曲库通过 FastAPI 获取</span>
            </div>
            <span
              class="about-val flex-none text-right font-mono text-[11.5px] font-bold opacity-[.72]"
              >PLANNED</span
            >
          </div>
        </div>
      </section></template
    >
  </div>
</template>
