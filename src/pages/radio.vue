<script setup lang="ts">
import { computed, reactive, toRefs, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackSuggestion from '@/components/player/TrackSuggestion.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import { artworkColor } from '@/services/player/artwork-color'
const { state, tracks, controller } = usePlayer()
const track = computed(() => tracks[state.radioSeed ?? state.idx])
// 电台片段在真实队列中的起始位置：当前曲之后一位，片段内本地行号加上它就是绝对队列位置。
const segStart = computed(() => {
  const queue = state.queue || []
  return queue.indexOf(state.idx) + 1
})
const upcoming = computed(() => {
  const queue = state.queue || []
  return queue.slice(segStart.value, segStart.value + 12)
})

// 电台队列拖拽状态：位置一律记绝对队列位置，与主队列面板共用同一套 moveQueue 重排。
const drag = reactive({
  /** 正在拖拽的绝对队列位置。 */
  from: null as number | null,
  /** 当前悬停的绝对队列位置。 */
  over: null as number | null,
  /** 是否放到目标行之后。 */
  after: false,
})

// 开始拖拽片段内的一行：本地行号换算为绝对队列位置后记录。
function startDrag(event: DragEvent, position: number): void {
  drag.from = segStart.value + position
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(drag.from))
  }
}

// 按目标行中线判断前插或后插，与主队列面板的悬停规则一致。
function hoverDrag(event: DragEvent, position: number): void {
  const target = segStart.value + position
  if (drag.from === null || drag.from === target) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  drag.over = target
  drag.after = event.clientY - rect.top > rect.height / 2
}

// 结束或取消拖拽后清除拖放标记，防止残留高亮。
function endDrag(): void {
  drag.from = null
  drag.over = null
}

// 放置后写回真实队列：目标插入点夹在片段范围内，绝不动已播与当前曲，也不把曲目拖出片段。
function dropDrag(event: DragEvent, position: number): void {
  event.preventDefault()
  if (drag.from !== null) {
    const start = segStart.value
    const target = Math.max(
      start,
      Math.min(
        start + upcoming.value.length,
        start + position + (drag.after ? 1 : 0)
      )
    )
    controller()?.moveQueue(drag.from, target)
  }
  endDrag()
}
// 节目行色阶类：按相似标签分三档，同专辑最实、同歌手次之、相似推荐最淡，行内 chip 据此取色。
function tagTier(index: number): string {
  const label = tag(index)
  return label === '同专辑'
    ? 'tag-album'
    : label === '同歌手'
      ? 'tag-artist'
      : 'tag-similar'
}
// 推荐标签按原稿种子的专辑和歌手判定。
function tag(index: number): string {
  const seed = track.value
  if (!seed) return ''
  return seed.album !== '—' && tracks[index]!.album === seed.album
    ? '同专辑'
    : tracks[index]!.artist === seed.artist
      ? '同歌手'
      : '相似推荐'
}
// 节目单构成统计：按相似标签逐行归类，供「关于这个电台」实时展示三种来源各占多少首。
const tagStats = computed(() => {
  const stats = { album: 0, artist: 0, similar: 0 }
  for (const index of upcoming.value) {
    const label = tag(index)
    if (label === '同专辑') stats.album += 1
    else if (label === '同歌手') stats.artist += 1
    else stats.similar += 1
  }
  return stats
})
// 种子来源说明：开启时种子锁定为开启那一刻的当前曲，未开启时将以当前选中曲目为种子。
const seedNote = computed(() => {
  const seed = track.value
  if (!seed) return ''
  return radioOn.value
    ? `种子来源 · 开启电台时正在播放的《${seed.title}》，节目单按同专辑 → 同歌手 → 相似推荐的顺序排，播完自动续播`
    : `种子来源 · 将以当前选中的《${seed.title}》开启电台，先排同专辑、再同歌手，其余按相似度续播`
})
// 节目单空态文案：无种子时先引导选歌，有种子时区分电台是否已开启。
const listEmptyLabel = computed(() =>
  !track.value
    ? '还没有节目单 — 先选一首歌作为种子'
    : radioOn.value
      ? '电台正在等待后续曲目'
      : '电台队列为空'
)
// 种子卡内的状态文案：跟随电台开关，说明当前种子与续播方式。
const statusText = computed(() => {
  const seed = track.value
  if (!seed) return ''
  return radioOn.value
    ? `电台进行中 · 以《${seed.title}》为种子，播完自动续播`
    : '开启后先排同专辑、再同歌手，其余按相似度排队续播'
})
const { radioOn, playing } = toRefs(state)

// 电台页展示状态：动效许可与舞台氛围色集中在此，模板只读这一组。
const view = reactive({
  /** 是否允许淡入淡出与律动动画（设置关闭动效或系统减动时为 false）。 */
  animate: true,
  /** 种子封面主色三元组（"r,g,b"）：供页面氛围与封面光环按不同透明度取用，取不到时为空串回退中性。 */
  accent: '',
})
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
// 同步动效许可：设置关闭动效或系统减动时立即切换为静态呈现。
function syncMotion(): void {
  view.animate = state.settings.motion && !reducedMotion.matches
}
watch(() => state.settings.motion, syncMotion, { immediate: true })
useEventListener(reducedMotion, 'change', syncMotion)

// 换种子时重新取封面主色，舞台氛围与光环随之更新；取色失败或结果已过期时回退中性。
watch(
  () => track.value?.cover,
  async (cover, _previous, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    if (!cover) {
      view.accent = ''
      return
    }
    const rgb = await artworkColor(cover, document)
    if (current) view.accent = rgb ? rgb.join(',') : ''
  },
  { immediate: true }
)
</script>

<template>
  <!-- radio 页面：电台控制台——左栏固定身份面板（唱片井、ON AIR 与开关），右栏节目单队列与电台信息。 -->
  <div
    class="page-panel hidden"
    data-panel="radio"
  >
    <div
      class="radio-shell"
      :style="view.accent ? { '--radio-accent': view.accent } : undefined"
    >
      <!-- 页头整行：左侧标题组，右侧状态位与左栏面板呼应（播出中指示点 / 未开启时种子歌名）。 -->
      <div class="pg-head radio-head">
        <div>
          <h3>歌曲电台</h3>
          <p>以当前歌曲为种子 · 同专辑、同歌手与相似歌曲自动续播</p>
        </div>
        <div
          class="radio-head-note"
          role="status"
        >
          <template v-if="radioOn">
            <span
              class="radio-live-dot"
              :class="{ 'dot-live': playing && view.animate }"
              aria-hidden="true"
            ></span>
            <span>{{ playing ? '播出中' : '电台进行中' }}</span>
          </template>
          <span
            v-else-if="track"
            class="radio-head-seed"
            >种子 · 《{{ track.title }}》</span
          >
        </div>
      </div>
      <div class="radio-grid">
        <!-- 左栏身份面板：sticky 固定，专辑色 wash 与同心波纹只压在面板内。 -->
        <aside class="radio-side">
          <div
            class="radio-sidewash"
            aria-hidden="true"
          ></div>
          <!-- ON AIR 半调层：仅电台开启时在面板顶部（唱片井上方）透出一层极淡网点，向下渐隐，被面板裁切收住。 -->
          <div
            v-if="radioOn"
            class="pop-halftone radio-halftone"
            :class="{ 'halftone-in': view.animate }"
            aria-hidden="true"
          ></div>
          <Transition
            name="radio-hero"
            mode="out-in"
            :css="view.animate"
          >
            <!-- 无种子空态：面板内放波普插画贴纸图，引导先选一首歌，并给出搜索与音乐库入口。 -->
            <div
              v-if="!track"
              key="empty"
              class="radio-empty"
            >
              <!-- 空态插画：少女抱黑胶的波普贴纸图，白边加投影，暗示从一首歌开始。 -->
              <img
                class="radio-empty-art"
                src="/images/pop-radio.webp"
                width="1600"
                height="1600"
                alt=""
                decoding="async"
              />
              <p class="m-0 text-[13px] leading-[1.6] opacity-[.68]">
                还没有种子歌曲 — 先选一首歌，电台会围绕它自动续播。
              </p>
              <div class="mt-[4px] flex flex-wrap items-center justify-center gap-[10px]">
                <BaseButton
                  class="smart-play inline-flex min-h-[38px] items-center rounded-full border-none px-[16px] text-[13px] font-extrabold"
                  @click="controller()?.navigate('search')"
                  >去搜索选歌</BaseButton
                >
                <BaseButton
                  class="radio-ghost inline-flex min-h-[38px] items-center rounded-full px-[16px] text-[13px] font-bold"
                  @click="controller()?.navigate('library')"
                  >打开音乐库</BaseButton
                >
              </div>
            </div>
            <!-- 身份区：唱片井当主角，台名、开关与状态文案在面板内沿纵轴成体系排布。 -->
            <section
              v-else
              key="seed"
              class="radio-hero radio-stage"
            >
              <div class="radio-chips">
                <span class="rseed-tag">种子 · SEED</span>
                <span
                  v-if="radioOn"
                  class="onair pop-sticker onair-pop"
                  :class="{ 'onair-live': playing, 'onair-static': !view.animate }"
                  role="status"
                >
                  <span
                    class="onair-bars"
                    aria-hidden="true"
                    ><i /><i /><i
                  /></span>
                  {{ playing ? 'ON AIR · 播出中' : '电台进行中' }}
                </span>
              </div>
              <div class="radio-coverwrap">
                <!-- 同心波纹：以唱片井为圆心荡开的专辑色细环，被面板裁切收住，播出时最外圈极慢呼吸扩散。 -->
                <div
                  class="radio-ripples"
                  aria-hidden="true"
                >
                  <i /><i /><i /><i
                    :class="{ 'ripple-live': playing && view.animate }"
                  />
                </div>
                <img
                  class="radio-cover-glow"
                  :src="track.cover"
                  alt=""
                  aria-hidden="true"
                />
                <!-- 唱片井：圆形封面坐进深色厚环，播放中封面本体缓慢旋转，暂停时冻结在当前角度。 -->
                <div class="radio-well">
                  <img
                    class="radio-cover"
                    :class="{
                      'disc-spin': view.animate,
                      'disc-paused': !playing,
                    }"
                    :src="track.cover"
                    alt=""
                  />
                </div>
              </div>
              <div class="rseed-txt radio-stage-txt">
                <b>《{{ track.title }}》电台</b>
                <span>{{ track.artist }} · {{ track.album }}</span>
              </div>
              <BaseButton
                class="banner-play radio-toggle inline-flex min-h-[46px] w-full items-center justify-center gap-[8px] rounded-full border-none px-[30px] py-[12px] text-[14px] font-extrabold"
                data-radio-toggle
                :disabled="!track"
                :aria-pressed="radioOn"
                @click="controller()?.toggleRadio()"
                >{{ radioOn ? '停止电台' : '开始电台' }}</BaseButton
              >
              <Transition
                name="radio-status"
                mode="out-in"
                :css="view.animate"
              >
                <span
                  :key="statusText"
                  class="radio-status"
                  data-radio-status
                  >{{ statusText }}</span
                >
              </Transition>
            </section>
          </Transition>
        </aside>
        <!-- 右栏：上半是带序号的节目单队列，下半是电台构成统计与种子来源。 -->
        <div class="radio-main">
          <div class="radio-secttl">节目单 · 接下来</div>
          <div
            class="radio-list flex flex-col gap-[10px]"
            data-radio-list
          >
            <!-- 节目行：左侧节目单序号 + 电台曲目建议组件（点播、下一首播放、相似标签与整行拖拽排序都在行内）。 -->
            <div
              v-for="(index, position) in upcoming"
              :key="`${index}:${position}`"
              class="radio-row"
              :class="tagTier(index)"
            >
              <span
                class="radio-no"
                aria-hidden="true"
                >{{ String(position + 1).padStart(2, '0') }}</span
              >
              <TrackSuggestion
                class="radio-row-item"
                :index="index"
                :meta="tag(index)"
                show-album
                drag-enabled
                :dragging="drag.from === segStart + position"
                :drop-before="drag.over === segStart + position && !drag.after"
                :drop-after="drag.over === segStart + position && drag.after"
                @dragstart="startDrag($event, position)"
                @dragover="hoverDrag($event, position)"
                @dragleave="drag.over = null"
                @dragend="endDrag"
                @drop="dropDrag($event, position)"
              />
            </div>
            <EmptyState
              v-if="!upcoming.length"
              class="radio-list-empty"
              icon="playlist"
              :label="listEmptyLabel"
            />
          </div>
          <!-- 关于这个电台：三种来源的实时计数与种子来源说明，只在有种子时出现。 -->
          <section
            v-if="track"
            class="radio-about"
          >
            <div class="radio-secttl">关于这个电台</div>
            <div class="radio-stats">
              <div
                class="radio-stat"
                data-radio-stat="album"
              >
                <b>{{ tagStats.album }}</b
                ><span>同专辑</span>
              </div>
              <div
                class="radio-stat"
                data-radio-stat="artist"
              >
                <b>{{ tagStats.artist }}</b
                ><span>同歌手</span>
              </div>
              <div
                class="radio-stat"
                data-radio-stat="similar"
              >
                <b>{{ tagStats.similar }}</b
                ><span>相似推荐</span>
              </div>
            </div>
            <!-- 种子来源：种子封面缩略打头，来源一眼可辨，文案随后。 -->
            <div class="radio-seednote">
              <img
                class="radio-seedthumb"
                :src="track.cover"
                alt=""
                aria-hidden="true"
              />
              <span>{{ seedNote }}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 控制台外壳：页头在上，分栏在下，整页用满内容区宽度。 */
.radio-shell {
  position: relative;
  padding: 0 4px 10px;
}

/* 页头整行：标题组在左，状态位在右并与面板顶边对齐，窄窗时自然换行；右侧留出浮动面板开关的避让位。 */
.radio-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 20px;
  padding-right: 46px;
}
.radio-head-note {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 7px;
  padding-top: 7px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
/* 播出指示点：取专辑色，播出且动效允许时缓慢呼吸；未开启时这里改显种子歌名小字。 */
.radio-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(var(--radio-accent, 255, 255, 255));
  box-shadow: 0 0 0 3px rgba(var(--radio-accent, 255, 255, 255), 0.18);
}
@media (prefers-reduced-motion: no-preference) {
  .radio-live-dot.dot-live {
    animation: radio-dot-pulse 1.6s ease-in-out infinite;
  }
}
@keyframes radio-dot-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.radio-head-seed {
  font-weight: 600;
  opacity: 0.6;
}

/* 版块标题与首页同规格：15px 特粗、字距 -0.01em（对齐 .feat-head h5）。 */
.radio-secttl {
  margin: 0 2px 12px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

/* 分栏：左栏身份面板固定宽，右栏节目单与信息弹性占满剩余宽度。 */
.radio-grid {
  display: flex;
  align-items: flex-start;
  gap: 28px;
  margin-top: 20px;
}

/* 左栏身份面板：sticky 固定在滚动视口顶部，玻璃底与圆角收住内部的 wash 与波纹；内边距四边对称，高度贴合内容。 */
.radio-side {
  position: sticky;
  top: 8px;
  flex: none;
  width: 384px;
  overflow: hidden;
  border-radius: 24px;
  padding: 24px;
}
.glass-win .radio-side {
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
}
/* 液态配方与首页 tile 对齐：155deg 渐变、26% 边、24% 顶部内高光。 */
.liquid-win .radio-side {
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.13),
    rgba(255, 255, 255, 0.045)
  );
  border: 1px solid rgba(255, 255, 255, 0.26);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 18px 44px rgba(0, 0, 0, 0.32);
}

/* 面板氛围：只取种子封面主色，以唱片井圆心（面板内 y≈200px）晕开一层柔和径向光，面板边缘保持干净。 */
.radio-sidewash {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle 360px at 50% 200px,
    rgba(var(--radio-accent, 255, 255, 255), 0.15),
    rgba(var(--radio-accent, 255, 255, 255), 0.05) 48%,
    transparent 72%
  );
  pointer-events: none;
}
.radio-stage,
.radio-empty {
  position: relative;
}

/* ON AIR 半调层：贴面板顶部横贯唱片井上方，网点极淡且向下渐隐；内容层（波纹、封面、文字）在其上方，不被覆盖。 */
.radio-halftone {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 190px;
  --pop-halftone-color: rgb(255 255 255 / 8%);
  --pop-halftone-size: 12px;
  mask-image: linear-gradient(180deg, #000 22%, transparent 92%);
  -webkit-mask-image: linear-gradient(180deg, #000 22%, transparent 92%);
}
@media (prefers-reduced-motion: no-preference) {
  .radio-halftone.halftone-in {
    animation: radio-halftone-in 260ms ease-out both;
  }
}
@keyframes radio-halftone-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 身份区：所有元素沿面板中轴排布，唱片井是唯一主角。 */
.radio-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.radio-chips {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 24px;
  margin-bottom: 20px;
}
.radio-stage .rseed-tag {
  margin-left: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  opacity: 0.85;
}

/* 唱片井：圆形封面坐进一口深色厚环（内阴影压出井深、顶部细高光描边），井外是专辑色柔光。 */
.radio-coverwrap {
  position: relative;
  flex: none;
  width: 264px;
  height: 264px;
}
.radio-well {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #2e2e35, #17171c 68%, #101014);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    inset 0 3px 8px rgba(255, 255, 255, 0.07),
    inset 0 16px 30px rgba(0, 0, 0, 0.48),
    inset 0 -16px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 24px 48px rgba(0, 0, 0, 0.48);
}
.radio-cover {
  width: 232px;
  height: 232px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.12),
    0 10px 26px rgba(0, 0, 0, 0.5);
}
.radio-cover-glow {
  position: absolute;
  inset: 0;
  width: 264px;
  height: 264px;
  border-radius: 50%;
  object-fit: cover;
  filter: blur(30px) saturate(1.3);
  opacity: 0.38;
  transform: scale(1.08) translateY(10px);
}

/* 封面本体旋转：动效允许时动画常驻，暂停用 animation-play-state 冻结在当前角度，不跳回起点。 */
@media (prefers-reduced-motion: no-preference) {
  .radio-cover.disc-spin {
    animation: radio-disc-spin 24s linear infinite;
  }
  .radio-cover.disc-paused {
    animation-play-state: paused;
  }
}
@keyframes radio-disc-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 同心波纹：以唱片井为圆心荡开的专辑色细环，透明度逐圈递减；最外圈在播出时极慢呼吸扩散，超出面板的部分被裁掉。 */
.radio-ripples {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}
.radio-ripples i {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid rgba(var(--radio-accent, 255, 255, 255), 0.09);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.radio-ripples i:nth-child(1) {
  width: 330px;
  height: 330px;
}
.radio-ripples i:nth-child(2) {
  width: 460px;
  height: 460px;
  border-color: rgba(var(--radio-accent, 255, 255, 255), 0.07);
}
.radio-ripples i:nth-child(3) {
  width: 590px;
  height: 590px;
  border-color: rgba(var(--radio-accent, 255, 255, 255), 0.055);
}
.radio-ripples i:nth-child(4) {
  width: 720px;
  height: 720px;
  border-color: rgba(var(--radio-accent, 255, 255, 255), 0.04);
}
@media (prefers-reduced-motion: no-preference) {
  .radio-ripples i.ripple-live {
    animation: radio-ripple-breathe 7s ease-in-out infinite alternate;
  }
}
@keyframes radio-ripple-breathe {
  from {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.55;
  }
  to {
    transform: translate(-50%, -50%) scale(1.04);
    opacity: 1;
  }
}

/* 台名与歌手专辑：面板内居中大字，长标题单行省略不撑破面板。 */
.radio-stage-txt {
  max-width: 100%;
  min-width: 0;
  margin-top: 22px;
}
.radio-stage-txt b {
  display: block;
  overflow: hidden;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.radio-stage-txt span {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.62;
}
.radio-toggle {
  margin-top: 18px;
}
/* 开关胶囊反馈：悬停提亮、按下轻缩，120–180ms，只动 filter/transform。 */
@media (prefers-reduced-motion: no-preference) {
  .radio-toggle {
    transition:
      filter 150ms ease,
      transform 150ms ease;
  }
}
.radio-toggle:hover:not(:disabled) {
  filter: brightness(1.07);
}
.radio-toggle:active:not(:disabled) {
  transform: scale(0.98);
}
/* 状态文案与右栏小字同规格：12px、行高 1.6。 */
.radio-status {
  display: block;
  max-width: 100%;
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  opacity: 0.55;
}

/* 无种子空态：面板内居中排布，插画贴纸图与按钮引导先选一首歌；内边距收紧，面板高度贴合内容。 */
.radio-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 6px 0;
  text-align: center;
}
/* 空态插画：圆角方形贴纸图，白色粗边加深色描线与投影，轻微倾斜模拟贴纸贴上感。 */
.radio-empty-art {
  box-sizing: border-box;
  width: 200px;
  height: 200px;
  border: 3px solid #fff;
  border-radius: 22px;
  object-fit: cover;
  box-shadow:
    0 0 0 1.5px rgb(10 8 18 / 55%),
    0 14px 30px rgb(0 0 0 / 38%);
  transform: rotate(-2deg);
}

/* ON AIR 指示：三柱律动，仅在播出中且动效允许时跳动。 */
.onair {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
/* ON AIR 贴纸徽章：播出时换成波普黄平涂、深色字与贴纸白边，.pop-sticker 提供投影，这里把倾斜收至 -4°；律动柱走 currentColor 自动转深色。 */
.onair.onair-pop {
  --pop-sticker-angle: -4deg;
  background: var(--pop-yellow);
  border: 2px solid #fff;
  color: var(--pop-ink);
}
.onair-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 11px;
}
.onair-bars i {
  width: 3px;
  height: 40%;
  border-radius: 2px;
  background: currentColor;
}
.onair-bars i:nth-child(2) {
  height: 85%;
  animation-delay: 0.25s;
}
.onair-bars i:nth-child(3) {
  height: 60%;
  animation-delay: 0.5s;
}
@media (prefers-reduced-motion: no-preference) {
  .onair-live .onair-bars i {
    animation: radio-eq 0.9s ease-in-out infinite alternate;
  }
}
.onair-static .onair-bars i {
  animation: none;
}
@keyframes radio-eq {
  from {
    height: 25%;
  }
  to {
    height: 100%;
  }
}

/* 空态次级入口：底色压到近透明、只留描边，与实心主按钮拉开主次；配方仍随双材质走。 */
.glass-win .radio-ghost {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}
.liquid-win .radio-ghost {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.36);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
  color: #fff;
}
/* 空态双按钮反馈：与开关胶囊同一套悬停提亮、按下轻缩。 */
@media (prefers-reduced-motion: no-preference) {
  .radio-ghost,
  .radio-empty .smart-play {
    transition:
      filter 150ms ease,
      transform 150ms ease;
  }
}
.radio-ghost:hover,
.radio-empty .smart-play:hover {
  filter: brightness(1.14);
}
.radio-ghost:active,
.radio-empty .smart-play:active {
  transform: scale(0.98);
}

/* 右栏：节目单与电台信息上下排布，弹性占满左栏之外的宽度。 */
.radio-main {
  flex: 1;
  min-width: 0;
}

/* 节目行：序号在胶囊左侧当节目单编号，曲目胶囊弹性占满行宽。 */
.radio-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* 序号用等宽数字字体，与右侧时长同一套数字语言，居中对齐胶囊行。 */
.radio-no {
  flex: none;
  width: 24px;
  font-family:
    ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  text-align: center;
  opacity: 0.38;
  font-variant-numeric: tabular-nums;
}
.radio-row-item {
  flex: 1;
  min-width: 0;
}

/* 右栏空态：图标块拉高到与左栏空面板相当，图标落在右栏竖向中线附近，不贴顶。 */
.radio-list-empty {
  min-height: 326px;
}

/* 电台队列：每行独立成一枚圆角胶囊（20px，与首页 tile 同圆角），表面色与页面拉开一层，行间留白呼吸。 */
.radio-list :deep(.srow) {
  padding: 9px 12px;
  border-color: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.045);
}
.radio-list :deep(.srow:hover) {
  border-color: rgba(255, 255, 255, 0.17);
  background-color: rgba(255, 255, 255, 0.075);
}
/* 液态行配方与首页 tile 对齐：155deg 渐变、26% 边、24% 顶部内高光。 */
.liquid-win .radio-list :deep(.srow) {
  border-color: rgba(255, 255, 255, 0.26);
  background-image: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.13),
    rgba(255, 255, 255, 0.045)
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
}
.liquid-win .radio-list :deep(.srow:hover) {
  border-color: rgba(255, 255, 255, 0.36);
}
/* 行内过渡：底色/边色 160ms 渐变，下一首按钮平时半透、整行悬停或聚焦时 150ms 淡入全显。 */
@media (prefers-reduced-motion: no-preference) {
  .radio-list :deep(.srow) {
    transition:
      background-color 160ms ease,
      border-color 160ms ease;
  }
  .radio-list :deep(.qnext) {
    transition:
      opacity 150ms ease,
      background-color 150ms ease;
  }
}
.radio-list :deep(.qnext) {
  opacity: 0.45;
}
.radio-list :deep(.srow:hover .qnext),
.radio-list :deep(.srow:focus-within .qnext) {
  opacity: 1;
}
/* 相似 chip 三档色阶：同专辑最实、同歌手居中、相似推荐最淡，仍走灰阶不抢眼。 */
.radio-list :deep(.stag) {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.09);
  opacity: 1;
}
.radio-row.tag-album :deep(.stag) {
  border-color: rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.15);
}
.radio-row.tag-similar :deep(.stag) {
  border-color: rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.045);
  opacity: 0.78;
}
.liquid-win .radio-list :deep(.stag) {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05));
  border-color: rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.liquid-win .radio-row.tag-album :deep(.stag) {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08));
  border-color: rgba(255, 255, 255, 0.38);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.liquid-win .radio-row.tag-similar :deep(.stag) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: none;
}
/* 当前播出行（正播曲目若出现在节目单中）：专辑色淡染底 + 左缘色条，在队列里一眼可辨。 */
.radio-list :deep(.srow.on) {
  border-color: rgba(var(--radio-accent, 255, 255, 255), 0.38);
  background-color: rgba(var(--radio-accent, 255, 255, 255), 0.13);
  box-shadow: inset 3px 0 0 rgba(var(--radio-accent, 255, 255, 255), 0.9);
}

/* 拖拽状态与主队列面板同一套语言：被拖行变淡，落点亮线沿目标胶囊的上/下缘标出。 */
.radio-list :deep(.srow.dragging) {
  opacity: 0.35;
}
.radio-list :deep(.srow.drop-before) {
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.9);
}
.radio-list :deep(.srow.drop-after) {
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.9);
}

/* 关于这个电台：与节目单之间一条发丝线分隔，三枚统计 tile 与首页 tile 同圆角同配方，数字与标签成组。 */
.radio-about {
  margin-top: 30px;
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}
.radio-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.radio-stat {
  padding: 16px 18px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.045);
}
/* 液态 tile 配方与首页对齐：155deg 渐变、26% 边、24% 顶部内高光。 */
.liquid-win .radio-stat {
  border-color: rgba(255, 255, 255, 0.26);
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.13),
    rgba(255, 255, 255, 0.045)
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
}
/* 统计数字大号等宽，与标签上下成组，三枚 tile 等高对齐。 */
.radio-stat b {
  display: block;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.radio-stat span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  opacity: 0.55;
}
/* 统计数字按来源染波普色：同专辑蓝、同歌手粉、相似推荐紫；标签仍走上面的灰。 */
.radio-stat[data-radio-stat='album'] b {
  color: var(--pop-blue);
}
.radio-stat[data-radio-stat='artist'] b {
  color: var(--pop-pink);
}
.radio-stat[data-radio-stat='similar'] b {
  color: var(--pop-violet);
}
/* 种子来源：18px 圆角封面缩略打头，文案随后，来源一眼可辨。 */
.radio-seednote {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 14px 2px 0;
  font-size: 12px;
  line-height: 1.65;
}
.radio-seedthumb {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 5px;
  object-fit: cover;
}
.radio-seednote span {
  opacity: 0.55;
}

/* 窄窗：分栏退化为单列，身份面板在上、节目单在下，唱片井同步缩小不溢出。 */
@media (max-width: 900px) {
  .radio-grid {
    flex-direction: column;
    gap: 22px;
  }
  .radio-side {
    position: static;
    width: 100%;
  }
  .radio-main {
    width: 100%;
  }
}
@media (max-width: 700px) {
  /* 窄窗唱片井缩小，面板 wash 圆心同步移到小井中心。 */
  .radio-sidewash {
    background: radial-gradient(
      circle 280px at 50% 168px,
      rgba(var(--radio-accent, 255, 255, 255), 0.15),
      rgba(var(--radio-accent, 255, 255, 255), 0.05) 48%,
      transparent 72%
    );
  }
  .radio-coverwrap,
  .radio-cover-glow {
    width: 200px;
    height: 200px;
  }
  .radio-cover {
    width: 176px;
    height: 176px;
  }
  .radio-ripples i:nth-child(1) {
    width: 254px;
    height: 254px;
  }
  .radio-ripples i:nth-child(2) {
    width: 352px;
    height: 352px;
  }
  .radio-ripples i:nth-child(3) {
    width: 450px;
    height: 450px;
  }
  .radio-ripples i:nth-child(4) {
    width: 548px;
    height: 548px;
  }
  .radio-stage-txt b {
    font-size: 20px;
  }
  .radio-empty-art {
    width: 150px;
    height: 150px;
  }
}

/* 状态切换淡入淡出：只动 opacity/transform，160–260ms。 */
@media (prefers-reduced-motion: no-preference) {
  .radio-hero-enter-active,
  .radio-hero-leave-active {
    transition:
      opacity 200ms ease,
      transform 200ms ease;
  }
  .radio-hero-enter-from {
    opacity: 0;
    transform: translateY(6px);
  }
  .radio-hero-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
  .radio-status-enter-active,
  .radio-status-leave-active {
    transition: opacity 160ms ease;
  }
  .radio-status-enter-from,
  .radio-status-leave-to {
    opacity: 0;
  }
}
</style>
