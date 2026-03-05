/**
 * 抽屉过渡动画组合式函数
 * 管理全屏播放器的共享元素过渡（封面飞入/飞出动画）
 * 包含降级方案：无法获取 footer 元素时使用滑入/滑出动画
 */
import { gsap } from 'gsap'
import type VinylDisc from '@/components/Player/VinylDisc.vue'

export interface DrawerTransitionOptions {
  /** 抽屉容器元素 */
  drawerRef: Ref<HTMLElement | null>
  /** VinylDisc 组件实例 */
  vinylDiscRef: Ref<InstanceType<typeof VinylDisc> | null>
  /** 当前歌曲 */
  currentSong: Ref<{ cover?: string } | null | undefined>
  /** 是否正在播放 */
  isPlaying: Ref<boolean>
}

export function useDrawerTransition(options: DrawerTransitionOptions) {
  const { drawerRef, vinylDiscRef, currentSong, isPlaying } = options

  /** 是否已渲染抽屉（控制 v-if） */
  const isRendered = ref(false)

  // ── 封面克隆工具 ──

  /** 生成封面背景图 CSS 值 */
  const coverBgImage = () =>
    currentSong.value?.cover
      ? `url(${currentSong.value.cover}?param=320x320)`
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

  /** 创建封面克隆 DOM 元素（固定定位，用于飞行动画） */
  const createClone = (rect: DOMRect, borderRadius: string) => {
    const el = document.createElement('div')
    el.className = 'hero-clone-cover'
    el.style.cssText = `
      position: fixed; z-index: 9999;
      width: ${rect.width}px; height: ${rect.height}px;
      left: ${rect.left}px; top: ${rect.top}px;
      border-radius: ${borderRadius};
      background-image: ${coverBgImage()};
      background-size: cover; background-position: center;
      pointer-events: none;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `
    document.body.appendChild(el)
    return el
  }

  /** 清理所有遗留的封面克隆元素 */
  const cleanupClones = () => {
    document.querySelectorAll('.hero-clone-cover').forEach(el => el.remove())
  }

  // ── 查询共享元素 ──

  /** 获取共享过渡所需的 DOM 元素 */
  const getTransitionElements = () => {
    const footer = document.getElementById('footer-cover')
    const cover = drawerRef.value?.querySelector('.album-cover') as HTMLElement | null
    const label = cover?.querySelector('.vinyl-label') as HTMLElement | null
    const songInfo = drawerRef.value?.querySelector('.song-info') as HTMLElement | null
    return { footer, cover, label, songInfo }
  }

  // ── 打开动画 ──

  /** 打开抽屉：共享元素过渡或降级滑入 */
  const open = async () => {
    if (!drawerRef.value) return

    gsap.set(drawerRef.value, { display: 'flex', opacity: 1 })
    await nextTick()

    const { footer, cover, label, songInfo } = getTransitionElements()

    if (footer && cover && label) {
      // 共享元素过渡：封面从 footer 飞向黑胶中心
      const footerRect = footer.getBoundingClientRect()
      const labelRect = label.getBoundingClientRect()
      const clone = createClone(footerRect, '8px')

      gsap.set(label, { opacity: 0 })
      gsap.set(songInfo, { opacity: 0 })

      // 背景淡入
      gsap.fromTo(
        drawerRef.value,
        { backgroundColor: 'rgba(0,0,0,0)' },
        { backgroundColor: 'rgba(0,0,0,0.95)', duration: 0.5, ease: 'power2.out' },
      )

      const tl = gsap.timeline({
        onComplete: () => {
          // 克隆淡出 → 真实元素淡入
          gsap.to(clone, { opacity: 0, duration: 0.2, ease: 'power2.out', onComplete: () => clone.remove() })
          gsap.to(label, { opacity: 1, duration: 0.2, ease: 'power2.out' })
          if (isPlaying.value) vinylDiscRef.value?.startAlbumRotation()
        },
      })

      // 飞向黑胶中心
      tl.to(clone, { width: labelRect.width, height: labelRect.height, left: labelRect.left, top: labelRect.top, borderRadius: '50%', duration: 0.6, ease: 'power3.out' })
      // 歌曲信息淡入
      tl.fromTo(songInfo!, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=0.3')
      // 歌词入场
      tl.fromTo('.lyric-line', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }, '-=0.2')
    } else {
      // 降级：滑入动画
      const tl = gsap.timeline({ onComplete: () => { if (isPlaying.value) vinylDiscRef.value?.startAlbumRotation() } })
      tl.fromTo(drawerRef.value, { y: '-100%', opacity: 0 }, { y: '0%', opacity: 1, duration: 0.6, ease: 'power3.out' })
        .fromTo('.album-cover', { y: -60, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, '-=0.4')
        .fromTo('.song-info', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.4')
        .fromTo('.lyric-line', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '-=0.3')
    }
  }

  // ── 关闭动画 ──

  /** 关闭抽屉：封面飞回 footer 或降级滑出 */
  const close = () => {
    if (!drawerRef.value) return

    vinylDiscRef.value?.stopAlbumRotation()
    cleanupClones()

    const { footer, cover, label } = getTransitionElements()

    if (footer && cover && label) {
      // 共享元素过渡：封面飞回 footer
      const footerRect = footer.getBoundingClientRect()
      const labelRect = label.getBoundingClientRect()
      const clone = createClone(labelRect, '50%')

      gsap.set(label, { opacity: 0 })
      gsap.to(drawerRef.value, { opacity: 0, duration: 0.3, ease: 'power2.in' })
      gsap.to(clone, {
        width: footerRect.width, height: footerRect.height,
        left: footerRect.left, top: footerRect.top,
        borderRadius: '8px', duration: 0.5, ease: 'power3.inOut',
        onComplete: () => { clone.remove(); isRendered.value = false },
      })
    } else {
      // 降级：滑出动画
      gsap.to(drawerRef.value, {
        y: '100%', opacity: 0, duration: 0.4, ease: 'power3.in',
        onComplete: () => { isRendered.value = false },
      })
    }
  }

  return { isRendered, open, close }
}
