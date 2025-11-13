<template>
  <div
    class="sm-scope absolute inset-0 z-30"
    :class="{ 'pointer-events-none': !open }"
    @click="onRootClick"
  >
    <!-- 预层 -->
    <div
      ref="preLayersRef"
      class="sm-prelayers pointer-events-none absolute top-0 right-0 bottom-0 z-[5]"
      aria-hidden="true"
    >
      <div
        v-for="(color, index) in processedColors"
        :key="index"
        class="sm-prelayer absolute top-0 right-0 h-full w-full translate-x-0"
        :style="{ background: color }"
      />
    </div>
    <!-- 抽屉 -->
    <aside
      id="staggered-menu-panel"
      ref="panelRef"
      class="staggered-menu-panel glass-card absolute top-0 right-0 z-10 flex h-full flex-col overflow-y-auto p-[6em_2em_2em_2em]"
      style="webkit-backdrop-filter: blur(12px)"
      :aria-hidden="!open"
      @click.stop
    >
      <div class="sm-panel-inner flex flex-1 flex-col gap-5">
        <ul
          class="sm-panel-list m-0 flex list-none flex-col gap-2 p-0"
          role="list"
          :data-numbering="displayItemNumbering || undefined"
        >
          <li
            v-if="displayedItems.length"
            v-for="(item, idx) in displayedItems"
            :key="(item.id ?? item.title ?? item.label) + '-' + idx"
            class="sm-panel-itemWrap relative overflow-hidden leading-none"
          >
            <div
              class="sm-panel-item relative inline-block cursor-pointer pr-[1.4em] leading-none font-semibold text-black no-underline transition-[background,color] duration-150 ease-linear"
              :data-index="idx + 1"
              @click="handleSelect(item, idx)"
            >
              <slot name="item" :item="item" :index="idx">
                <span
                  class="sm-panel-itemLabel inline-block origin-[50%_100%] will-change-transform"
                >
                  {{ getLabel(item) }}
                </span>
                <div class="sm-song-row mt-3 flex items-center gap-3">
                  <div class="sm-index mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-black/10 text-xs text-[#111]/80">
                    {{ idx + 1 }}
                  </div>
                  <div class="sm-cover h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/40">
                    <img v-if="item.cover" :src="item.cover" alt="cover" class="h-full w-full object-cover" />
                    <div v-else class="flex h-full w-full items-center justify-center text-lg text-[#111]/70">♪</div>
                  </div>
                  <div class="sm-meta flex min-w-0 flex-1 flex-col">
                    <div class="sm-meta-title truncate text-sm font-semibold text-[#111]">{{ item.name }}</div>
                    <div class="sm-meta-artist truncate text-xs text-[#111]/70">{{ getSubtitle(item) }}</div>
                    <div v-if="item.album" class="sm-meta-album truncate text-xs text-[#111]/50">{{ item.album }}</div>
                  </div>
                  <div class="sm-actions ml-2 flex items-center gap-3">
                    <div class="sm-duration text-xs text-[#111]/60">{{ item.duration || '' }}</div>
                    <button class="sm-play inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-[#111] transition-transform duration-200 hover:scale-110" @click.stop="handleSelect(item, idx)">
                      <span class="icon-[mdi--play] h-4 w-4"></span>
                    </button>
                  </div>
                </div>
              </slot>
            </div>
          </li>
          <li
            v-else
            class="sm-panel-itemWrap relative overflow-hidden leading-none"
            aria-hidden="true"
          >
            <span
              class="sm-panel-item relative inline-block cursor-pointer pr-[1.4em] text-[4rem] leading-none font-semibold tracking-[-2px] text-black uppercase no-underline transition-[background,color] duration-150 ease-linear"
            >
              <span class="sm-panel-itemLabel inline-block origin-[50%_100%] will-change-transform"
                >暂无最近播放</span
              >
            </span>
          </li>
        </ul>

        <div
          v-if="displaySocials && socialItems && socialItems.length > 0"
          class="sm-socials mt-auto flex flex-col gap-3 pt-8"
          aria-label="Social links"
        >
          <h3 class="sm-socials-title m-0 text-base font-medium text-(--sm-accent,#ff0000)">
            Socials
          </h3>
          <ul
            class="sm-socials-list m-0 flex list-none flex-row flex-wrap items-center gap-4 p-0"
            role="list"
          >
            <li v-for="(social, i) in socialItems" :key="social.label + i" class="sm-socials-item">
              <a
                :href="social.link"
                target="_blank"
                rel="noopener noreferrer"
                class="sm-socials-link relative inline-block py-[2px] text-[1.2rem] font-medium text-[#111] no-underline transition-[color,opacity] duration-300 ease-linear"
              >
                {{ social.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { gsap } from 'gsap'
import { useAudioStore } from '@/stores/modules/audio'
import type { Song } from '@/stores/interface'

interface StaggeredMenuSocialItem {
  label: string
  link: string
}
interface RecentDrawerProps {
  position?: 'left' | 'right'
  colors?: string[]
  items?: Song[]
  socialItems?: StaggeredMenuSocialItem[]
  displaySocials?: boolean
  displayItemNumbering?: boolean
  accentColor?: string
  onMenuOpen?: () => void
  onMenuClose?: () => void
}

const props = withDefaults(defineProps<RecentDrawerProps>(), {
  position: 'right',
  colors: () => ['#9EF2B2', '#27FF64'],
  items: () => [],
  socialItems: () => [],
  displaySocials: true,
  displayItemNumbering: false,
  accentColor: '#27FF64',
})

const emit = defineEmits<{ (e: 'select', item: Song, index: number): void }>()

const open = defineModel<boolean>('open')

const panelRef = useTemplateRef('panelRef')
const preLayersRef = useTemplateRef('preLayersRef')
const preLayerElsRef = ref<HTMLElement[]>([])

const openTlRef = ref<gsap.core.Timeline | null>(null)
const closeTweenRef = ref<gsap.core.Tween | null>(null)
const spinTweenRef = ref<gsap.core.Timeline | null>(null)
const textCycleAnimRef = ref<gsap.core.Tween | null>(null)
const colorTweenRef = ref<gsap.core.Tween | null>(null)

const busyRef = ref(false)

const itemEntranceTweenRef = ref<gsap.core.Tween | null>(null)

const processedColors = computed(() => {
  const raw =
    props.colors && props.colors.length ? props.colors.slice(0, 4) : ['#20251F', '#353F37']
  const arr = [...raw]
  if (arr.length >= 3) {
    const mid = Math.floor(arr.length / 2)
    arr.splice(mid, 1)
  }
  return arr
})

const audioStore = useAudioStore()
const recentHistory = computed(() => audioStore.audio.playHistory || [])
const displayedItems = computed<Song[]>(() => {
  if (props.items && props.items.length) return props.items
  return recentHistory.value
})

const getLabel = (item: Song): string => {
  return String(item.name ?? '')
}
const getSubtitle = (item: Song): string => {
  return String(item.artist ?? '')
}
const formatRelative = (ts: number): string => {
  const now = Date.now()
  const diff = Math.max(0, now - ts)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}秒前`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}天前`
  const w = Math.floor(d / 7)
  return `${w}周前`
}

const handleSelect = (item: Song, index: number) => {
  emit('select', item, index)
}

let gsapContext: gsap.Context | null = null

const initializeGSAP = () => {
  gsapContext = gsap.context(() => {
    const panel = panelRef.value
    const preContainer = preLayersRef.value
    if (!panel) return

    let preLayers: HTMLElement[] = []
    if (preContainer) {
      preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLElement[]
    }
    preLayerElsRef.value = preLayers

    const offscreen = props.position === 'left' ? -100 : 100
    gsap.set([panel, ...preLayers], { xPercent: offscreen })
  })
}

const buildOpenTimeline = (): gsap.core.Timeline | null => {
  const panel = panelRef.value
  const layers = preLayerElsRef.value
  if (!panel) return null

  openTlRef.value?.kill()
  if (closeTweenRef.value) {
    closeTweenRef.value.kill()
    closeTweenRef.value = null
  }
  itemEntranceTweenRef.value?.kill()

  const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel')) as HTMLElement[]
  const numberEls = Array.from(
    panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item')
  ) as HTMLElement[]
  const socialTitle = panel.querySelector('.sm-socials-title') as HTMLElement | null
  const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link')) as HTMLElement[]

  const layerStates = layers.map((el: HTMLElement) => ({
    el,
    start: Number(gsap.getProperty(el, 'xPercent')),
  }))
  const panelStart = Number(gsap.getProperty(panel, 'xPercent'))

  if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 })
  const rowEls = Array.from(panel.querySelectorAll('.sm-song-row')) as HTMLElement[]
  const coverEls = Array.from(panel.querySelectorAll('.sm-cover')) as HTMLElement[]
  const metaTitleEls = Array.from(panel.querySelectorAll('.sm-meta-title')) as HTMLElement[]
  const metaArtistEls = Array.from(panel.querySelectorAll('.sm-meta-artist')) as HTMLElement[]
  const metaAlbumEls = Array.from(panel.querySelectorAll('.sm-meta-album')) as HTMLElement[]
  const actionEls = Array.from(panel.querySelectorAll('.sm-actions')) as HTMLElement[]
  const indexEls = Array.from(panel.querySelectorAll('.sm-index')) as HTMLElement[]
  const fadeTargets = [
    ...rowEls,
    ...indexEls,
    ...coverEls,
    ...metaTitleEls,
    ...metaArtistEls,
    ...metaAlbumEls,
    ...actionEls,
  ]
  if (fadeTargets.length) gsap.set(fadeTargets, { y: 25, opacity: 0 })
  if (numberEls.length)
    gsap.set(numberEls, { ['--sm-num-opacity' as keyof Record<string, number>]: 0 })
  if (socialTitle) gsap.set(socialTitle, { opacity: 0 })
  if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 })

  const tl = gsap.timeline({ paused: true })

  layerStates.forEach((ls: { el: HTMLElement; start: number }, i: number) => {
    tl.fromTo(
      ls.el,
      { xPercent: ls.start },
      { xPercent: 0, duration: 0.5, ease: 'power4.out' },
      i * 0.07
    )
  })

  const lastTime = layerStates.length ? (layerStates.length - 1) * 0.07 : 0
  const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0)
  const panelDuration = 0.65

  tl.fromTo(
    panel,
    { xPercent: panelStart },
    { xPercent: 0, duration: panelDuration, ease: 'power4.out' },
    panelInsertTime
  )

  if (itemEls.length) {
    const itemsStartRatio = 0.15
    const itemsStart = panelInsertTime + panelDuration * itemsStartRatio

    tl.to(
      itemEls,
      {
        yPercent: 0,
        rotate: 0,
        duration: 1,
        ease: 'power4.out',
        stagger: { each: 0.1, from: 'start' },
      },
      itemsStart
    )

    if (fadeTargets.length) {
      tl.to(
        fadeTargets,
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          ease: 'power3.out',
          stagger: { each: 0.06, from: 'start' },
        },
        itemsStart + 0.04
      )
    }

    if (numberEls.length) {
      tl.to(
        numberEls,
        {
          duration: 0.6,
          ease: 'power2.out',
          ['--sm-num-opacity' as keyof Record<string, number>]: 1,
          stagger: { each: 0.08, from: 'start' },
        },
        itemsStart + 0.1
      )
    }
  }

  if (socialTitle || socialLinks.length) {
    const socialsStart = panelInsertTime + panelDuration * 0.4

    if (socialTitle)
      tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: 'power2.out' }, socialsStart)
    if (socialLinks.length) {
      tl.to(
        socialLinks,
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          ease: 'power3.out',
          stagger: { each: 0.08, from: 'start' },
          onComplete: () => {
            gsap.set(socialLinks, { clearProps: 'opacity' })
          },
        },
        socialsStart + 0.04
      )
    }
  }

  openTlRef.value = tl
  return tl
}

const playOpen = () => {
  if (busyRef.value) return
  busyRef.value = true
  const tl = buildOpenTimeline()
  if (tl) {
    tl.eventCallback('onComplete', () => {
      busyRef.value = false
    })
    tl.play(0)
  } else {
    busyRef.value = false
  }
}

const playClose = () => {
  openTlRef.value?.kill()
  openTlRef.value = null
  itemEntranceTweenRef.value?.kill()

  const panel = panelRef.value
  const layers = preLayerElsRef.value
  if (!panel) return

  const all: HTMLElement[] = [...layers, panel]
  closeTweenRef.value?.kill()

  const offscreen = props.position === 'left' ? -100 : 100

  closeTweenRef.value = gsap.to(all, {
    xPercent: offscreen,
    duration: 0.32,
    ease: 'power3.in',
    overwrite: 'auto',
    onComplete: () => {
      const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel')) as HTMLElement[]
      if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 })

      const resetTargets = Array.from(
        panel.querySelectorAll(
          '.sm-song-row, .sm-cover, .sm-meta-title, .sm-meta-artist, .sm-actions'
        )
      ) as HTMLElement[]
      if (resetTargets.length) gsap.set(resetTargets, { y: 25, opacity: 0 })

      const numberEls = Array.from(
        panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item')
      ) as HTMLElement[]
      if (numberEls.length)
        gsap.set(numberEls, { ['--sm-num-opacity' as keyof Record<string, number>]: 0 })

      const socialTitle = panel.querySelector('.sm-socials-title') as HTMLElement | null
      const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link')) as HTMLElement[]
      if (socialTitle) gsap.set(socialTitle, { opacity: 0 })
      if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 })

      busyRef.value = false
    },
  })
}

const onRootClick = (e: MouseEvent) => {
  if (!open.value) return
  const panel = panelRef.value
  if (panel && panel.contains(e.target as Node)) return
  open.value = false
}

watch(open, newVal => {
  if (newVal) {
    props.onMenuOpen?.()
    playOpen()
  } else {
    props.onMenuClose?.()
    playClose()
  }
})

watch(
  () => props.position,
  () => {
    nextTick(() => {
      if (gsapContext) {
        gsapContext.revert()
      }
      initializeGSAP()
    })
  }
)

onMounted(() => {
  nextTick(() => {
    initializeGSAP()
  })
})

onBeforeUnmount(() => {
  openTlRef.value?.kill()
  closeTweenRef.value?.kill()
  spinTweenRef.value?.kill()
  textCycleAnimRef.value?.kill()
  colorTweenRef.value?.kill()
  itemEntranceTweenRef.value?.kill()

  if (gsapContext) {
    gsapContext.revert()
  }
})
</script>

<style scoped>
.sm-scope .staggered-menu-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 40;
}

.sm-scope .staggered-menu-header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2em;
  background: transparent;
  pointer-events: none;
  z-index: 20;
}

.sm-scope .staggered-menu-header > * {
  pointer-events: auto;
}

.sm-scope .sm-logo {
  display: flex;
  align-items: center;
  user-select: none;
}

.sm-scope .sm-logo-img {
  display: block;
  height: 32px;
  width: auto;
  object-fit: contain;
}

.sm-scope .sm-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #e9e9ef;
  font-weight: 500;
  line-height: 1;
  overflow: visible;
}

.sm-scope .sm-toggle:focus-visible {
  outline: 2px solid #ffffffaa;
  outline-offset: 4px;
  border-radius: 4px;
}

.sm-scope .sm-line:last-of-type {
  margin-top: 6px;
}

.sm-scope .sm-toggle-textWrap {
  position: relative;
  margin-right: 0.5em;
  display: inline-block;
  height: 1em;
  overflow: hidden;
  white-space: nowrap;
  width: var(--sm-toggle-width, auto);
  min-width: var(--sm-toggle-width, auto);
}

.sm-scope .sm-toggle-textInner {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.sm-scope .sm-toggle-line {
  display: block;
  height: 1em;
  line-height: 1;
}

.sm-scope .sm-icon {
  position: relative;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.sm-scope .sm-panel-itemWrap {
  position: relative;
  overflow: hidden;
  line-height: 1;
}

.sm-scope .sm-icon-line {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  height: 2px;
  background: currentColor;
  border-radius: 2px;
  transform: translate(-50%, -50%);
  will-change: transform;
}

.sm-scope .sm-line {
  display: none !important;
}

.sm-scope .staggered-menu-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: clamp(260px, 38vw, 420px);
  height: 100%;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  padding: 6em 2em 2em 2em;
  overflow-y: auto;
  z-index: 10;
}

.sm-scope [data-position='left'] .staggered-menu-panel {
  right: auto;
  left: 0;
}

.sm-scope .sm-prelayers {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: clamp(260px, 38vw, 420px);
  pointer-events: none;
  z-index: 5;
}

.sm-scope [data-position='left'] .sm-prelayers {
  right: auto;
  left: 0;
}

.sm-scope .sm-prelayer {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 100%;
  transform: translateX(0);
}

.sm-scope .sm-panel-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sm-scope .sm-socials {
  margin-top: auto;
  padding-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sm-scope .sm-socials-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--sm-accent, #ff0000);
}

.sm-scope .sm-socials-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.sm-scope .sm-socials-list .sm-socials-link {
  opacity: 1;
  transition: opacity 0.3s ease;
}

.sm-scope .sm-socials-list:hover .sm-socials-link:not(:hover) {
  opacity: 0.35;
}

.sm-scope .sm-socials-list:focus-within .sm-socials-link:not(:focus-visible) {
  opacity: 0.35;
}

.sm-scope .sm-socials-list .sm-socials-link:hover,
.sm-scope .sm-socials-list .sm-socials-link:focus-visible {
  opacity: 1;
}

.sm-scope .sm-socials-link:focus-visible {
  outline: 2px solid var(--sm-accent, #ff0000);
  outline-offset: 3px;
}

.sm-scope .sm-socials-link {
  font-size: 1.2rem;
  font-weight: 500;
  color: #111;
  text-decoration: none;
  position: relative;
  padding: 2px 0;
  display: inline-block;
  transition:
    color 0.3s ease,
    opacity 0.3s ease;
}

.sm-scope .sm-socials-link:hover {
  color: var(--sm-accent, #ff0000);
}

.sm-scope .sm-panel-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
}

.sm-scope .sm-panel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sm-scope .sm-panel-item {
  position: relative;
  color: #000;
  font-weight: 600;
  font-size: 1.25rem;
  cursor: pointer;
  line-height: 1;
  letter-spacing: 0;
  text-transform: none;
  transition:
    background 0.25s,
    color 0.25s;
  display: inline-block;
  text-decoration: none;
  padding-right: 1.4em;
}

.sm-scope .sm-panel-itemLabel {
  display: inline-block;
  will-change: transform;
  transform-origin: 50% 100%;
  font-size: 1rem;
  text-transform: none;
}

.sm-scope .sm-song-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.sm-scope .sm-index {
  height: 1.5rem;
  width: 1.5rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: rgba(17, 17, 17, 0.8);
  background: rgba(0, 0, 0, 0.1);
}

.sm-scope .sm-cover {
  height: 3rem;
  width: 3rem;
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.4);
}

.sm-scope .sm-meta-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #111;
}

.sm-scope .sm-meta-artist {
  font-size: 0.75rem;
  color: rgba(17, 17, 17, 0.7);
}

.sm-scope .sm-meta-album {
  font-size: 0.75rem;
  color: rgba(17, 17, 17, 0.5);
}

.sm-scope .sm-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: 0.5rem;
}

.sm-scope .sm-duration {
  font-size: 0.75rem;
  color: rgba(17, 17, 17, 0.6);
}

.sm-scope .sm-play {
  height: 2rem;
  width: 2rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.1);
  color: #111;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.sm-scope .sm-panel-item:hover {
  color: var(--sm-accent, #ff0000);
}

.sm-scope .sm-panel-list[data-numbering] {
  counter-reset: smItem;
}

.sm-scope .sm-panel-list[data-numbering] .sm-panel-item::after {
  counter-increment: smItem;
  content: counter(smItem, decimal-leading-zero);
  position: absolute;
  top: 0.1em;
  right: 3.2em;
  font-size: 18px;
  font-weight: 400;
  color: var(--sm-accent, #ff0000);
  letter-spacing: 0;
  pointer-events: none;
  user-select: none;
  opacity: var(--sm-num-opacity, 0);
}

@media (max-width: 1024px) {
  .sm-scope .staggered-menu-panel {
    width: 100%;
    left: 0;
    right: 0;
  }
  .sm-scope .staggered-menu-wrapper[data-open] .sm-logo-img {
    filter: invert(100%);
  }
}

@media (max-width: 640px) {
  .sm-scope .staggered-menu-panel {
    width: 100%;
    left: 0;
    right: 0;
  }
  .sm-scope .staggered-menu-wrapper[data-open] .sm-logo-img {
    filter: invert(100%);
  }
}
</style>
