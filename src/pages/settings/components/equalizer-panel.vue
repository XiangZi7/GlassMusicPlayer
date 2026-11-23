<script setup lang="ts">
import { computed, reactive, toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import { usePlayer } from '@/composables/usePlayer'
import { notify } from '@/services/notification'
import {
  equalizerBands,
  equalizerPresets,
  equalizerHeadroom,
  parseEqualizerGains,
} from '@/services/player/equalizer'

interface UserPreset {
  id: string
  name: string
  description: string
  gains: number[]
  preamp: number
}
const player = usePlayer()
const { settings } = toRefs(player.state)
const gains = computed(() => parseEqualizerGains(player.state.settings.eqGains))
// 响应式状态
const state = reactive({
  // 自定义预设名称草稿，不直接写入主窗口。
  name: '',
  // 删除自定义预设需要用户确认。
  deletePreset: null as UserPreset | null,
  // 是否展示删除确认弹窗。
  deleteOpen: false,
})
const { name, deletePreset, deleteOpen } = toRefs(state)
const customPresets = computed(() => {
  try {
    const value: unknown = JSON.parse(player.state.settings.eqCustomPresets)
    if (!Array.isArray(value)) return []
    return value
      .filter(
        item =>
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          Array.isArray(item.gains) &&
          item.gains.length === 10 &&
          Number.isFinite(item.preamp)
      )
      .slice(0, 20)
      .map(item => ({
        id: item.id,
        name: item.name.slice(0, 40),
        description: '我的自定义预设',
        gains: parseEqualizerGains(item.gains.join(',')),
        preamp: Math.max(-12, Math.min(12, item.preamp)),
      })) as UserPreset[]
  } catch {
    return []
  }
})
const description = computed(
  () =>
    [...equalizerPresets, ...customPresets.value].find(
      item => item.name === player.state.settings.eq
    )?.description || '自定义频段曲线；双击任意滑杆可归零该频段。'
)
const effectivePreamp = computed(() =>
  equalizerHeadroom({
    enabled: true,
    preamp: player.state.settings.eqPreamp,
    gains: gains.value,
    autoHeadroom: player.state.settings.eqAutoHeadroom,
  })
)
const points = computed(() =>
  gains.value
    .map((gain, index) => `${22 + index * 66},${72 - gain * 4}`)
    .join(' ')
)
const statusLabel = computed(
  () =>
    ({
      active: 'EQ 已作用于真实音频',
      bypassed: '当前为旁路 / 原声',
      pending: '等待真实音源或音频权限',
      unavailable: '当前音源不支持 EQ，保持原声',
    })[player.state.equalizerStatus]
)

// 将增益位置换算成轨道填充区间，始终从 0 dB 填充到当前档位。
function gainFill(gain: number, vertical = false) {
  const position = 50 + (vertical ? -gain : gain) / 24 * 100
  return {
    '--eq-fill-start': `${Math.min(position, 50)}%`,
    '--eq-fill-end': `${Math.max(position, 50)}%`,
  }
}

// 选择预设时只更新当前设置草稿，点击应用/保存后才改变主窗口音色。
function choosePreset(preset: {
  name: string
  gains: readonly number[]
  preamp: number
}): void {
  player.setSetting('eq', preset.name)
  player.setSetting('eqGains', preset.gains.join(','))
  player.setSetting('eqPreamp', preset.preamp)
  player.setSetting('eqEnabled', true)
}

// 连续拖动只改变该频段数值；音频侧在应用后做平滑参数更新，不闪烁整个面板。
function updateBand(index: number, value: number): void {
  const next = [...gains.value]
  next[index] = Number.isFinite(value) ? Math.max(-12, Math.min(12, value)) : 0
  player.setSetting('eqGains', next.join(','))
  player.setSetting('eq', '自定义')
}

// 前级增益在安全范围内变化，自动余量保护可以进一步衰减叠加峰值。
function updatePreamp(event: Event): void {
  player.setSetting(
    'eqPreamp',
    Math.max(
      -12,
      Math.min(12, Number((event.target as HTMLInputElement).value))
    )
  )
}

// 归零曲线与前级，不擅自改变 EQ 开关。
function resetCurve(): void {
  player.setSetting('eqGains', equalizerBands.map(() => 0).join(','))
  player.setSetting('eqPreamp', 0)
  player.setSetting('eq', '平直')
}

// 保存最多二十个独立自定义预设，仍属于可取消的设置草稿。
function savePreset(): void {
  const title = state.name.trim()
  if (!title || title.length > 40) {
    notify('请输入 1–40 字的预设名称。', 'error')
    return
  }
  if (equalizerPresets.some(item => item.name === title)) {
    notify('请使用与内置预设不同的名称。', 'error')
    return
  }
  const next = customPresets.value.filter(item => item.name !== title)
  if (next.length >= 20) {
    notify('最多保存 20 个自定义预设，请先删除不需要的项目。', 'error')
    return
  }
  next.push({
    id: `user-${Date.now().toString(36)}`,
    name: title,
    description: '我的自定义预设',
    gains: [...gains.value],
    preamp: player.state.settings.eqPreamp,
  })
  player.setSetting('eqCustomPresets', JSON.stringify(next))
  player.setSetting('eq', title)
  state.name = ''
  notify('预设已加入草稿，点击应用或保存后写入本机。')
}

// 删除前展示明确确认，不影响当前正在使用的曲线。
function requestDelete(preset: UserPreset): void {
  state.deletePreset = preset
  state.deleteOpen = true
}
// 确认后仅从草稿中删除指定预设，取消设置仍可撤销。
function confirmDelete(): void {
  if (state.deletePreset)
    player.setSetting(
      'eqCustomPresets',
      JSON.stringify(
        customPresets.value.filter(item => item.id !== state.deletePreset!.id)
      )
    )
  state.deleteOpen = false
  state.deletePreset = null
  notify('预设已从草稿移除，应用后生效。')
}
</script>

<template>
  <!-- 均衡器完整业务区：真实十频段、保护设置、预设和自定义集中展示。 -->
  <section
    class="eq-panel space-y-[14px]"
    :class="{ 'eq-calm': !settings.motion }"
  >
    <header class="flex flex-wrap items-center justify-between gap-[12px]">
      <div>
        <h3 class="m-0 text-[14px] font-bold">十频段均衡器</h3>
        <p class="mt-[4px] mb-0 text-[11.5px] leading-[1.6] text-white/55">
          31 Hz–16 kHz · 每段 ±12 dB · 0.5 dB 步进
        </p>
      </div>
      <!-- EQ 开关：关闭后走旁路，内置预设不会强行替代原始声音。 -->
      <BaseButton
        class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
        :class="{ on: settings.eqEnabled }"
        role="switch"
        :aria-checked="settings.eqEnabled"
        aria-label="启用均衡器"
        @click="player.setSetting('eqEnabled', !settings.eqEnabled)"
        ><i
      /></BaseButton>
    </header>
    <div class="set-card rounded-[16px] border border-transparent p-[12px]">
      <div class="flex items-center justify-between gap-[10px]">
        <span class="text-[11px] font-bold text-white/55">设置曲线 · dB</span
        ><span class="text-[11px] text-white/50">{{
          settings.eqEnabled ? settings.eq : '旁路'
        }}</span>
      </div>
      <!-- 曲线预览：展示设置值，不冒充设备频响测量。 -->
      <svg
        class="mt-[6px] block h-[82px] w-full"
        viewBox="0 0 640 144"
        preserveAspectRatio="none"
        role="img"
        aria-label="十个频段的增益设置曲线"
      >
        <path
          d="M22 24H616M22 72H616M22 120H616"
          stroke="currentColor"
          class="text-white/10"
          stroke-dasharray="3 5"
        />
        <text
          x="0"
          y="27"
          class="eq-axis"
        >
          +12
        </text>
        <text
          x="7"
          y="76"
          class="eq-axis"
        >
          0
        </text>
        <text
          x="0"
          y="123"
          class="eq-axis"
        >
          −12
        </text>
        <polygon
          :points="`22,72 ${points} 616,72`"
          fill="currentColor"
          class="text-white/5"
        />
        <polyline
          :points="points"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          class="text-white/80"
        />
        <circle
          v-for="(gain, index) in gains"
          :key="index"
          :cx="22 + index * 66"
          :cy="72 - gain * 4"
          r="3"
          fill="currentColor"
          class="text-white/90"
        />
      </svg>
      <!-- 十频段滑杆：原生键盘可操作，频段说明和当前 dB 可由辅助技术读取。 -->
      <div class="eq-bands grid grid-cols-10 gap-[6px]">
        <label
          v-for="(band, index) in equalizerBands"
          :key="band.frequency"
          class="flex min-w-0 flex-col items-center gap-[6px]"
          :title="band.description"
        >
          <output
            class="text-[10px] font-semibold whitespace-nowrap tabular-nums"
            >{{ gains[index]! > 0 ? '+' : ''
            }}{{ gains[index]!.toFixed(1) }}</output
          >
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            :value="gains[index]"
            :aria-label="`${band.label} 增益`"
            :aria-valuetext="`${gains[index]} 分贝`"
            class="eq-slider eq-band"
            :style="gainFill(gains[index]!, true)"
            @input="
              updateBand(
                index,
                Number(($event.target as HTMLInputElement).value)
              )
            "
            @dblclick="updateBand(index, 0)"
          />
          <span class="text-[10px] whitespace-nowrap text-white/65">{{
            band.label
          }}</span>
        </label>
      </div>
      <div
        class="mt-[10px] flex flex-wrap items-center justify-between gap-[8px]"
      >
        <span class="text-[10.5px] text-white/45"
          >双击滑杆归零该段；曲线不是硬件校准或听力保护保证。</span
        ><BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[11px]"
          @click="resetCurve"
          >重置曲线</BaseButton
        >
      </div>
    </div>
    <div
      class="set-card space-y-[12px] rounded-[16px] border border-transparent p-[14px]"
    >
      <!-- 前级与余量：用户增益和保护后的估算增益分别展示。 -->
      <div class="flex flex-wrap items-center gap-[12px]">
        <div class="min-w-0 flex-1">
          <b class="text-[12px]">前级增益</b>
          <p class="mt-[4px] mb-0 text-[11px] text-white/50">
            保护后估算 {{ effectivePreamp.toFixed(1) }} dB（48 kHz）
          </p>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="0.5"
          :value="settings.eqPreamp"
          aria-label="均衡器前级增益"
          class="eq-slider eq-preamp"
          :style="gainFill(settings.eqPreamp)"
          @input="updatePreamp"
        /><span class="w-[58px] text-right text-[11px] tabular-nums"
          >{{ settings.eqPreamp.toFixed(1) }} dB</span
        >
      </div>
      <div class="flex items-center gap-[12px]">
        <div class="min-w-0 flex-1">
          <b class="text-[12px]">自动余量保护</b>
          <p class="mt-[4px] mb-0 text-[11px] leading-[1.6] text-white/50">
            考虑相邻滤波器的叠加峰值并降低前级，减少正增益削波风险。关闭后请保守调整音量。
          </p>
        </div>
        <BaseButton
          class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
          :class="{ on: settings.eqAutoHeadroom }"
          role="switch"
          :aria-checked="settings.eqAutoHeadroom"
          aria-label="自动余量保护"
          @click="player.setSetting('eqAutoHeadroom', !settings.eqAutoHeadroom)"
          ><i
        /></BaseButton>
      </div>
      <p
        class="m-0 border-t border-white/8 pt-[10px] text-[11px] leading-[1.6] text-white/55"
      >
        主窗口状态：{{
          statusLabel
        }}。应用或保存后生效。当前音源不支持 EQ 时会保持原声。
      </p>
    </div>
    <!-- 内置预设：每项有明确用途说明，切换说明文字有短淡入淡出。 -->
    <section>
      <h4 class="mb-[8px] text-[12px] font-bold">
        内置预设 · {{ equalizerPresets.length }} 种
      </h4>
      <div class="grid grid-cols-3 gap-[7px]">
        <BaseButton
          v-for="preset in equalizerPresets"
          :key="preset.id"
          class="eq-preset rounded-[11px] border border-white/8 bg-white/3 px-[11px] py-[9px] text-left text-[12px] transition-colors hover:bg-white/8"
          :class="{ selected: settings.eq === preset.name }"
          :aria-pressed="settings.eq === preset.name"
          :title="preset.description"
          @click="choosePreset(preset)"
          >{{ preset.name }}</BaseButton
        >
      </div>
      <div class="mt-[8px] min-h-[34px]">
        <Transition
          name="eq-copy"
          mode="out-in"
          ><p
            :key="settings.eq"
            class="m-0 text-[11px] leading-[1.6] text-white/50"
          >
            {{ description }}
          </p></Transition
        >
      </div>
    </section>
    <!-- 自定义预设：最多二十项，保存和删除仍遵循设置草稿语义。 -->
    <section>
      <h4 class="mb-[8px] text-[12px] font-bold">我的预设</h4>
      <form
        class="flex gap-[8px]"
        @submit.prevent="savePreset"
      >
        <input
          v-model="name"
          maxlength="40"
          aria-label="自定义均衡器预设名称"
          placeholder="为当前曲线命名…"
          class="min-w-0 flex-1 rounded-[10px] border border-white/12 bg-white/5 px-[11px] py-[8px] text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/65"
        /><BaseButton
          type="submit"
          class="imp-pick rounded-full px-[12px] py-[7px] text-[12px]"
          >保存预设</BaseButton
        >
      </form>
      <div
        v-if="customPresets.length"
        class="mt-[8px] space-y-[5px]"
      >
        <div
          v-for="preset in customPresets"
          :key="preset.id"
          class="flex items-center gap-[8px] rounded-[10px] bg-white/3 px-[10px] py-[7px]"
        >
          <BaseButton
            class="min-w-0 flex-1 truncate bg-transparent text-left text-[12px]"
            @click="choosePreset(preset)"
            >{{ preset.name }}</BaseButton><BaseButton
            class="rounded-full px-[9px] py-[5px] text-[11px] text-white/50 hover:bg-white/8 hover:text-white"
            :aria-label="`删除预设 ${preset.name}`"
            @click="requestDelete(preset)"
            >删除</BaseButton
          >
        </div>
      </div>
    </section>
    <!-- 自定义删除确认：仅删除指定预设，不清理播放配置或其它用户数据。 -->
    <BaseDialog
      v-model="deleteOpen"
      labelled-by="eq-delete-title"
      ><div class="p-[22px]">
        <h3
          id="eq-delete-title"
          class="m-0 text-[15px] font-bold"
        >
          删除自定义预设？
        </h3>
        <p class="mt-[10px] text-[12px] text-white/60">
          移除「{{
            deletePreset?.name
          }}」，当前曲线仍然保留；修改应用前可通过取消设置撤销。
        </p>
        <div class="mt-[16px] flex justify-end gap-[8px]">
          <BaseButton
            class="imp-pick rounded-full px-[13px] py-[7px]"
            @click="deleteOpen = false"
            >取消</BaseButton
          ><BaseButton
            class="banner-play rounded-full px-[13px] py-[7px]"
            @click="confirmDelete"
            >删除预设</BaseButton
          >
        </div>
      </div></BaseDialog
    >
  </section>
</template>

<style scoped>
.eq-axis {
  font-size: 13px;
  fill: rgb(255 255 255 / 55%);
}
input.eq-slider {
  --eq-track: rgb(255 255 255 / 18%);
  --eq-fill: rgb(199 202 255 / 72%);
  --eq-zero: rgb(255 255 255 / 30%);
  --eq-thumb-size: 12px;
  margin: 0;
  border-radius: 999px;
  background:
    linear-gradient(var(--eq-zero), var(--eq-zero)) center / var(--eq-zero-size) no-repeat,
    linear-gradient(
      var(--eq-track-direction),
      var(--eq-track) 0 var(--eq-fill-start),
      var(--eq-fill) var(--eq-fill-start) var(--eq-fill-end),
      var(--eq-track) var(--eq-fill-end) 100%
    ) center / var(--eq-track-size) no-repeat;
}

input.eq-band {
  --eq-track-direction: to bottom;
  --eq-track-size: 4px calc(100% - var(--eq-thumb-size));
  --eq-zero-size: 10px 1px;
  width: 28px;
  max-width: 100%;
  height: 82px;
  flex: none;
  writing-mode: vertical-lr;
  direction: rtl;
}

input.eq-preamp {
  --eq-track-direction: to right;
  --eq-track-size: calc(100% - var(--eq-thumb-size)) 4px;
  --eq-zero-size: 1px 10px;
  width: 160px;
  max-width: 100%;
  height: 22px;
}

input.eq-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: var(--eq-thumb-size);
  background: transparent;
}

input.eq-band::-webkit-slider-runnable-track {
  width: var(--eq-thumb-size);
  height: 100%;
}

input.eq-slider::-webkit-slider-thumb {
  width: var(--eq-thumb-size);
  height: var(--eq-thumb-size);
  margin: 0;
  background: #f3f2ff;
}

input.eq-slider::-moz-range-track,
input.eq-slider::-moz-range-progress {
  background: transparent;
}

input.eq-slider::-moz-range-thumb {
  width: var(--eq-thumb-size);
  height: var(--eq-thumb-size);
  background: #f3f2ff;
}
.eq-preset.selected {
  background: rgb(255 255 255 / 0.12);
  border-color: rgb(255 255 255 / 0.3);
}
.eq-panel :deep(:focus-visible) {
  outline: 2px solid rgb(255 255 255 / 0.72);
  outline-offset: 3px;
}
.eq-copy-enter-active,
.eq-copy-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}
.eq-copy-enter-from,
.eq-copy-leave-to {
  opacity: 0;
  transform: translateY(3px);
}
.eq-calm .eq-copy-enter-active,
.eq-calm .eq-copy-leave-active {
  transition: none;
}
.eq-calm .eq-copy-enter-from,
.eq-calm .eq-copy-leave-to {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .eq-copy-enter-active,
  .eq-copy-leave-active {
    transition: none;
  }
  .eq-copy-enter-from,
  .eq-copy-leave-to {
    transform: none;
  }
}
</style>
