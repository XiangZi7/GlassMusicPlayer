import { gsap } from 'gsap'

export interface SharedElementOptions {
  duration?: number
  ease?: string
  borderRadius?: { from: string; to: string }
  scale?: { from: number; to: number }
  onStart?: () => void
  onComplete?: () => void
}

/**
 * 共享元素动画组合式函数
 * 用于创建类似 iOS 的共享元素过渡动画
 */
export function useSharedElement() {
  /**
   * 创建抛物线飞行动画 - 元素沿抛物线从一个位置飞到另一个位置
   */
  const flyTo = (
    sourceEl: HTMLElement | null,
    targetEl: HTMLElement | null,
    imageUrl: string,
    options: SharedElementOptions = {}
  ): Promise<void> => {
    return new Promise(resolve => {
      if (!sourceEl || !targetEl) {
        resolve()
        return
      }

      const {
        duration = 0.6,
        ease = 'power2.out',
        borderRadius = { from: '12px', to: '12px' },
        scale = { from: 1, to: 1 },
        onStart,
        onComplete,
      } = options

      const sourceRect = sourceEl.getBoundingClientRect()
      const targetRect = targetEl.getBoundingClientRect()

      // 计算起点和终点中心坐标
      const startX = sourceRect.left + sourceRect.width / 2
      const startY = sourceRect.top + sourceRect.height / 2
      const endX = targetRect.left + targetRect.width / 2
      const endY = targetRect.top + targetRect.height / 2

      // 计算抛物线参数
      const deltaX = endX - startX
      const deltaY = endY - startY
      // 抛物线高度：根据水平距离和方向调整
      const arcHeight = Math.min(Math.abs(deltaX) * 0.5, 150) * (deltaY > 0 ? -1 : -1.2)

      // 创建克隆元素
      const clone = document.createElement('div')
      clone.className = 'shared-element-clone'
      clone.style.cssText = `
        position: fixed;
        z-index: 9999;
        width: ${sourceRect.width}px;
        height: ${sourceRect.height}px;
        left: ${sourceRect.left}px;
        top: ${sourceRect.top}px;
        border-radius: ${borderRadius.from};
        background-image: url(${imageUrl});
        background-size: cover;
        background-position: center;
        pointer-events: none;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        transform: scale(${scale.from});
        will-change: transform, width, height, left, top, border-radius;
      `
      document.body.appendChild(clone)

      onStart?.()

      // 动画进度对象
      const progress = { t: 0 }

      // 使用 GSAP 动画进度来计算抛物线位置
      gsap.to(progress, {
        t: 1,
        duration,
        ease,
        onUpdate: () => {
          const t = progress.t

          // 线性插值 X 和尺寸
          const currentX = startX + deltaX * t
          const currentWidth = sourceRect.width + (targetRect.width - sourceRect.width) * t
          const currentHeight = sourceRect.height + (targetRect.height - sourceRect.height) * t

          // 抛物线 Y：y = startY + deltaY * t + arcHeight * 4 * t * (1 - t)
          // 4 * t * (1-t) 在 t=0.5 时达到最大值 1
          const parabola = 4 * t * (1 - t)
          const currentY = startY + deltaY * t + arcHeight * parabola

          // 计算旋转角度（增加动感）
          const rotation = (1 - t) * (deltaX > 0 ? 15 : -15)

          // 应用位置和尺寸
          clone.style.left = `${currentX - currentWidth / 2}px`
          clone.style.top = `${currentY - currentHeight / 2}px`
          clone.style.width = `${currentWidth}px`
          clone.style.height = `${currentHeight}px`
          clone.style.transform = `scale(${scale.from + (scale.to - scale.from) * t}) rotate(${rotation}deg)`

          // 插值圆角
          const fromRadius = parseFloat(borderRadius.from) || 12
          const toRadius = parseFloat(borderRadius.to) || 12
          const currentRadius = fromRadius + (toRadius - fromRadius) * t
          clone.style.borderRadius = `${currentRadius}px`
        },
        onComplete: () => {
          clone.remove()
          onComplete?.()
          resolve()
        },
      })
    })
  }

  /**
   * 创建展开动画 - 元素从卡片展开成全屏
   */
  const expandTo = (
    sourceEl: HTMLElement | null,
    options: SharedElementOptions & {
      imageUrl?: string
      targetBounds?: { width: number; height: number; left: number; top: number }
    } = {}
  ): Promise<HTMLElement | null> => {
    return new Promise(resolve => {
      if (!sourceEl) {
        resolve(null)
        return
      }

      const {
        duration = 0.5,
        ease = 'power3.out',
        borderRadius = { from: '24px', to: '0px' },
        imageUrl,
        targetBounds,
        onStart,
        onComplete,
      } = options

      const sourceRect = sourceEl.getBoundingClientRect()
      const target = targetBounds || {
        width: window.innerWidth,
        height: window.innerHeight,
        left: 0,
        top: 0,
      }

      // 创建展开遮罩
      const overlay = document.createElement('div')
      overlay.className = 'shared-element-overlay'
      overlay.style.cssText = `
        position: fixed;
        z-index: 9998;
        inset: 0;
        background: rgba(0,0,0,0);
        pointer-events: none;
        will-change: background;
      `
      document.body.appendChild(overlay)

      // 创建克隆元素
      const clone = document.createElement('div')
      clone.className = 'shared-element-expand'
      clone.style.cssText = `
        position: fixed;
        z-index: 9999;
        width: ${sourceRect.width}px;
        height: ${sourceRect.height}px;
        left: ${sourceRect.left}px;
        top: ${sourceRect.top}px;
        border-radius: ${borderRadius.from};
        background: rgba(0,0,0,0.8);
        backdrop-filter: blur(20px);
        pointer-events: none;
        overflow: hidden;
        will-change: transform, width, height, left, top, border-radius;
      `

      if (imageUrl) {
        const img = document.createElement('div')
        img.style.cssText = `
          position: absolute;
          inset: 0;
          background-image: url(${imageUrl});
          background-size: cover;
          background-position: center;
          opacity: 0.3;
          filter: blur(30px);
          transform: scale(1.2);
        `
        clone.appendChild(img)
      }

      document.body.appendChild(clone)

      onStart?.()

      const tl = gsap.timeline({
        onComplete: () => {
          onComplete?.()
          resolve(clone)
        },
      })

      // 背景淡入
      tl.to(overlay, {
        background: 'rgba(0,0,0,0.5)',
        duration: duration * 0.6,
        ease: 'power2.out',
      }, 0)

      // 卡片展开
      tl.to(clone, {
        width: target.width,
        height: target.height,
        left: target.left,
        top: target.top,
        borderRadius: borderRadius.to,
        duration,
        ease,
      }, 0)
    })
  }

  /**
   * 收起动画 - 从全屏收起回卡片
   */
  const collapseTo = (
    expandedEl: HTMLElement | null,
    targetEl: HTMLElement | null,
    options: SharedElementOptions = {}
  ): Promise<void> => {
    return new Promise(resolve => {
      if (!expandedEl || !targetEl) {
        expandedEl?.remove()
        document.querySelector('.shared-element-overlay')?.remove()
        resolve()
        return
      }

      const {
        duration = 0.4,
        ease = 'power3.inOut',
        borderRadius = { from: '0px', to: '24px' },
        onStart,
        onComplete,
      } = options

      const targetRect = targetEl.getBoundingClientRect()
      const overlay = document.querySelector('.shared-element-overlay') as HTMLElement

      onStart?.()

      const tl = gsap.timeline({
        onComplete: () => {
          expandedEl.remove()
          overlay?.remove()
          onComplete?.()
          resolve()
        },
      })

      // 背景淡出
      if (overlay) {
        tl.to(overlay, {
          background: 'rgba(0,0,0,0)',
          duration: duration * 0.8,
          ease: 'power2.in',
        }, 0)
      }

      // 卡片收起
      tl.to(expandedEl, {
        width: targetRect.width,
        height: targetRect.height,
        left: targetRect.left,
        top: targetRect.top,
        borderRadius: borderRadius.to,
        duration,
        ease,
      }, 0)
    })
  }

  /**
   * 创建涟漪效果
   */
  const createRipple = (
    event: MouseEvent,
    container: HTMLElement,
    color: string = 'rgba(255, 255, 255, 0.3)'
  ) => {
    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const ripple = document.createElement('span')
    ripple.className = 'ripple-effect'

    const size = Math.max(rect.width, rect.height) * 2
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
      background: radial-gradient(circle, ${color} 0%, transparent 70%);
      border-radius: 50%;
      transform: scale(0);
      opacity: 1;
      pointer-events: none;
      z-index: 1;
    `

    container.style.position = container.style.position || 'relative'
    container.style.overflow = 'hidden'
    container.appendChild(ripple)

    gsap.to(ripple, {
      scale: 1,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => ripple.remove(),
    })
  }

  /**
   * 创建脉冲光环效果
   */
  const createPulse = (
    element: HTMLElement,
    color: string = 'rgba(236, 72, 153, 0.5)'
  ) => {
    const rect = element.getBoundingClientRect()
    const parent = element.parentElement
    if (!parent) return

    const pulse = document.createElement('div')
    pulse.className = 'pulse-ring'
    pulse.style.cssText = `
      position: absolute;
      width: ${rect.width}px;
      height: ${rect.height}px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: inherit;
      border: 2px solid ${color};
      pointer-events: none;
      z-index: 0;
    `

    parent.style.position = parent.style.position || 'relative'
    parent.appendChild(pulse)

    gsap.to(pulse, {
      scale: 1.5,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out',
      onComplete: () => pulse.remove(),
    })
  }

  /**
   * 创建 3D 按压效果
   */
  const create3DPress = (element: HTMLElement) => {
    const handleMouseDown = () => {
      gsap.to(element, {
        scale: 0.95,
        rotateX: 5,
        rotateY: -5,
        duration: 0.1,
        ease: 'power2.out',
      })
    }

    const handleMouseUp = () => {
      gsap.to(element, {
        scale: 1,
        rotateX: 0,
        rotateY: 0,
        duration: 0.3,
        ease: 'elastic.out(1, 0.5)',
      })
    }

    element.addEventListener('mousedown', handleMouseDown)
    element.addEventListener('mouseup', handleMouseUp)
    element.addEventListener('mouseleave', handleMouseUp)
    element.style.transformStyle = 'preserve-3d'
    element.style.perspective = '1000px'

    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
      element.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mouseleave', handleMouseUp)
    }
  }

  /**
   * 列表项错开入场动画
   */
  const staggerIn = (
    elements: HTMLElement[] | NodeListOf<Element>,
    options: {
      from?: gsap.TweenVars
      to?: gsap.TweenVars
      stagger?: number
      duration?: number
      ease?: string
    } = {}
  ) => {
    const {
      from = { y: 30, opacity: 0 },
      to = { y: 0, opacity: 1 },
      stagger = 0.05,
      duration = 0.4,
      ease = 'power2.out',
    } = options

    gsap.fromTo(elements, from, {
      ...to,
      duration,
      stagger,
      ease,
    })
  }

  return {
    flyTo,
    expandTo,
    collapseTo,
    createRipple,
    createPulse,
    create3DPress,
    staggerIn,
  }
}
