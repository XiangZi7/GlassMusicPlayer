import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Directive, DirectiveBinding } from 'vue'

// 注册 ScrollTrigger 插件
gsap.registerPlugin(ScrollTrigger)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDirective = Directive<HTMLElement, any>

interface StaggerOptions {
  delay?: number
  duration?: number
  stagger?: number
  from?: gsap.TweenVars
  to?: gsap.TweenVars
  ease?: string
}

/**
 * v-stagger-in 指令
 * 用于列表项的错开入场动画
 *
 * 使用方式:
 * <div v-stagger-in="{ delay: 0.1, stagger: 0.05 }">
 *   <div class="stagger-item">Item 1</div>
 *   <div class="stagger-item">Item 2</div>
 * </div>
 *
 * 或者使用默认配置:
 * <div v-stagger-in>
 *   <div class="stagger-item">Item 1</div>
 * </div>
 */
export const vStaggerIn: Directive<HTMLElement, StaggerOptions> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<StaggerOptions>) {
    const options = binding.value || {}
    const {
      delay = 0,
      duration = 0.4,
      stagger = 0.06,
      from = { y: 30, opacity: 0, scale: 0.95 },
      to = { y: 0, opacity: 1, scale: 1 },
      ease = 'power2.out',
    } = options

    // 查找子元素
    const items = el.querySelectorAll('.stagger-item')
    if (items.length === 0) {
      // 如果没有指定 stagger-item，则对所有直接子元素进行动画
      const children = el.children
      if (children.length > 0) {
        gsap.fromTo(children, from, {
          ...to,
          duration,
          stagger,
          delay,
          ease,
        })
      }
    } else {
      gsap.fromTo(items, from, {
        ...to,
        duration,
        stagger,
        delay,
        ease,
      })
    }
  },
}

/**
 * v-fade-in 指令
 * 元素淡入动画
 */
export const vFadeIn: Directive<HTMLElement, { delay?: number; duration?: number }> = {
  mounted(el: HTMLElement, binding) {
    const { delay = 0, duration = 0.5 } = binding.value || {}

    gsap.fromTo(
      el,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration, delay, ease: 'power2.out' }
    )
  },
}

/**
 * v-scale-in 指令
 * 元素缩放入场动画
 */
export const vScaleIn: Directive<HTMLElement, { delay?: number; duration?: number }> = {
  mounted(el: HTMLElement, binding) {
    const { delay = 0, duration = 0.4 } = binding.value || {}

    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration, delay, ease: 'back.out(1.7)' }
    )
  },
}

/**
 * v-slide-in 指令
 * 元素滑入动画
 */
export const vSlideIn: Directive<
  HTMLElement,
  { direction?: 'left' | 'right' | 'up' | 'down'; delay?: number; duration?: number }
> = {
  mounted(el: HTMLElement, binding) {
    const { direction = 'up', delay = 0, duration = 0.5 } = binding.value || {}

    const fromVars: gsap.TweenVars = { opacity: 0 }

    switch (direction) {
      case 'left':
        fromVars.x = -50
        break
      case 'right':
        fromVars.x = 50
        break
      case 'up':
        fromVars.y = 50
        break
      case 'down':
        fromVars.y = -50
        break
    }

    gsap.fromTo(el, fromVars, {
      opacity: 1,
      x: 0,
      y: 0,
      duration,
      delay,
      ease: 'power3.out',
    })
  },
}

/**
 * v-hover-lift 指令
 * 悬停时元素上浮效果
 */
export const vHoverLift: Directive<HTMLElement, { y?: number; scale?: number }> = {
  mounted(el: HTMLElement, binding) {
    const { y = -8, scale = 1.02 } = binding.value || {}

    const handleEnter = () => {
      gsap.to(el, {
        y,
        scale,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    const handleLeave = () => {
      gsap.to(el, {
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    el.addEventListener('mouseenter', handleEnter)
    el.addEventListener('mouseleave', handleLeave)

    // 存储清理函数
    ;(el as any)._hoverLiftCleanup = () => {
      el.removeEventListener('mouseenter', handleEnter)
      el.removeEventListener('mouseleave', handleLeave)
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any)._hoverLiftCleanup?.()
  },
}

/**
 * v-parallax 指令
 * 视差滚动效果
 */
export const vParallax: Directive<HTMLElement, { speed?: number }> = {
  mounted(el: HTMLElement, binding) {
    const { speed = 0.5 } = binding.value || {}

    const handleScroll = () => {
      const rect = el.getBoundingClientRect()
      const scrolled = window.scrollY
      const rate = (rect.top + scrolled - window.innerHeight / 2) * speed

      gsap.set(el, {
        y: rate * 0.1,
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    ;(el as any)._parallaxCleanup = () => {
      window.removeEventListener('scroll', handleScroll)
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any)._parallaxCleanup?.()
  },
}

/**
 * v-scroll-in 指令
 * 滚动触发入场动画 - 元素进入视口时触发动画
 * 使用 IntersectionObserver 实现，支持任意滚动容器
 *
 * 使用方式:
 * <div v-scroll-in>内容</div>
 * <div v-scroll-in="{ direction: 'left', delay: 0.2 }">从左侧滑入</div>
 * <div v-scroll-in="{ stagger: true }">子元素错开入场</div>
 */
export const vScrollIn: Directive<
  HTMLElement,
  {
    direction?: 'up' | 'down' | 'left' | 'right'
    delay?: number
    duration?: number
    distance?: number
    stagger?: boolean
    staggerDelay?: number
    once?: boolean
    threshold?: number
  }
> = {
  mounted(el: HTMLElement, binding) {
    const {
      direction = 'up',
      delay = 0,
      duration = 0.6,
      distance = 40,
      stagger = false,
      staggerDelay = 0.08,
      once = true,
      threshold = 0.1,
    } = binding.value || {}

    // 计算起始位置
    const fromVars: gsap.TweenVars = { opacity: 0 }
    switch (direction) {
      case 'left':
        fromVars.x = -distance
        break
      case 'right':
        fromVars.x = distance
        break
      case 'up':
        fromVars.y = distance
        break
      case 'down':
        fromVars.y = -distance
        break
    }

    // 设置初始状态
    if (stagger) {
      const items = el.querySelectorAll('.stagger-item')
      const targets = items.length > 0 ? items : el.children
      gsap.set(targets, fromVars)
    } else {
      gsap.set(el, fromVars)
    }

    // 使用 IntersectionObserver 检测元素是否进入视口
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (stagger) {
              const items = el.querySelectorAll('.stagger-item')
              const targets = items.length > 0 ? items : el.children
              gsap.to(targets, {
                opacity: 1,
                x: 0,
                y: 0,
                duration,
                delay,
                stagger: staggerDelay,
                ease: 'power3.out',
              })
            } else {
              gsap.to(el, {
                opacity: 1,
                x: 0,
                y: 0,
                duration,
                delay,
                ease: 'power3.out',
              })
            }

            // 如果只触发一次，则取消观察
            if (once) {
              observer.unobserve(el)
            }
          }
        })
      },
      {
        threshold,
        rootMargin: '0px 0px -10% 0px', // 提前一点触发
      }
    )

    observer.observe(el)

    // 存储清理函数
    ;(el as any)._scrollInCleanup = () => {
      observer.disconnect()
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any)._scrollInCleanup?.()
  },
}

/**
 * v-tilt 指令
 * 3D 卡片倾斜效果 - 鼠标移动时卡片产生透视倾斜
 *
 * 使用方式:
 * <div v-tilt>卡片内容</div>
 * <div v-tilt="{ max: 15, scale: 1.05, speed: 300 }">自定义参数</div>
 */
export const vTilt: Directive<
  HTMLElement,
  {
    max?: number
    scale?: number
    speed?: number
    glare?: boolean
    glareMax?: number
  }
> = {
  mounted(el: HTMLElement, binding) {
    const {
      max = 10,
      scale = 1.02,
      speed = 400,
      glare = true,
      glareMax = 0.2,
    } = binding.value || {}

    // 设置初始样式
    el.style.transformStyle = 'preserve-3d'
    el.style.transition = `transform ${speed}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`

    // 创建光泽层
    let glareEl: HTMLElement | null = null
    if (glare) {
      glareEl = document.createElement('div')
      glareEl.className = 'tilt-glare'
      glareEl.style.cssText = `
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0) 50%,
          rgba(255, 255, 255, ${glareMax}) 100%
        );
        opacity: 0;
        transition: opacity ${speed}ms ease;
        z-index: 10;
      `
      el.style.position = el.style.position || 'relative'
      el.style.overflow = 'hidden'
      el.appendChild(glareEl)
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // 计算鼠标相对于中心的位置 (-1 到 1)
      const mouseX = (e.clientX - centerX) / (rect.width / 2)
      const mouseY = (e.clientY - centerY) / (rect.height / 2)

      // 计算旋转角度
      const rotateX = -mouseY * max
      const rotateY = mouseX * max

      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`

      // 更新光泽位置
      if (glareEl) {
        const glareX = (mouseX + 1) / 2
        const glareY = (mouseY + 1) / 2
        const angle = Math.atan2(mouseY, mouseX) * (180 / Math.PI) + 135
        glareEl.style.background = `linear-gradient(${angle}deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, ${glareMax * Math.sqrt(mouseX ** 2 + mouseY ** 2)}) 100%)`
        glareEl.style.opacity = '1'
      }
    }

    const handleMouseEnter = () => {
      el.style.transition = 'none'
      if (glareEl) glareEl.style.opacity = '1'
    }

    const handleMouseLeave = () => {
      el.style.transition = `transform ${speed}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`
      el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
      if (glareEl) glareEl.style.opacity = '0'
    }

    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseenter', handleMouseEnter)
    el.addEventListener('mouseleave', handleMouseLeave)

    ;(el as any)._tiltCleanup = () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseenter', handleMouseEnter)
      el.removeEventListener('mouseleave', handleMouseLeave)
      glareEl?.remove()
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any)._tiltCleanup?.()
  },
}

/**
 * v-magnetic 指令
 * 磁性按钮效果 - 鼠标靠近时元素产生吸附效果
 *
 * 使用方式:
 * <button v-magnetic>查看全部</button>
 * <button v-magnetic="{ strength: 0.5, distance: 100 }">自定义参数</button>
 */
export const vMagnetic: Directive<
  HTMLElement,
  {
    strength?: number
    distance?: number
  }
> = {
  mounted(el: HTMLElement, binding) {
    const { strength = 0.4, distance = 80 } = binding.value || {}

    // 保存原始位置
    el.style.position = el.style.position || 'relative'
    el.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)'

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const deltaX = e.clientX - centerX
      const deltaY = e.clientY - centerY
      const dist = Math.sqrt(deltaX ** 2 + deltaY ** 2)

      if (dist < distance) {
        // 计算吸附偏移
        const pull = 1 - dist / distance
        const moveX = deltaX * strength * pull
        const moveY = deltaY * strength * pull

        gsap.to(el, {
          x: moveX,
          y: moveY,
          duration: 0.3,
          ease: 'power2.out',
        })
      }
    }

    const handleMouseLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)',
      })
    }

    // 监听父元素或者更大范围
    const parent = el.parentElement || document.body

    parent.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', handleMouseLeave)

    ;(el as any)._magneticCleanup = () => {
      parent.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', handleMouseLeave)
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any)._magneticCleanup?.()
  },
}

/**
 * v-spotlight 指令
 * 光标追踪高亮效果 - 鼠标移动时产生光晕追踪
 *
 * 使用方式:
 * <div v-spotlight>卡片容器</div>
 * <div v-spotlight="{ color: 'rgba(236, 72, 153, 0.15)', size: 300 }">粉色光晕</div>
 */
export const vSpotlight: Directive<
  HTMLElement,
  {
    color?: string
    size?: number
    opacity?: number
  }
> = {
  mounted(el: HTMLElement, binding) {
    const {
      color = 'rgba(255, 255, 255, 0.08)',
      size = 250,
      opacity = 1,
    } = binding.value || {}

    // 确保父元素有定位
    el.style.position = el.style.position || 'relative'
    el.style.overflow = 'hidden'

    // 创建光晕元素
    const spotlight = document.createElement('div')
    spotlight.className = 'spotlight-effect'
    spotlight.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: radial-gradient(circle, ${color} 0%, transparent 70%);
      pointer-events: none;
      opacity: 0;
      transform: translate(-50%, -50%);
      transition: opacity 0.3s ease;
      z-index: 1;
      mix-blend-mode: plus-lighter;
    `
    el.appendChild(spotlight)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      spotlight.style.left = `${x}px`
      spotlight.style.top = `${y}px`
      spotlight.style.opacity = String(opacity)
    }

    const handleMouseLeave = () => {
      spotlight.style.opacity = '0'
    }

    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', handleMouseLeave)

    ;(el as any)._spotlightCleanup = () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', handleMouseLeave)
      spotlight.remove()
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any)._spotlightCleanup?.()
  },
}

/**
 * v-card-spotlight 指令
 * 卡片边框光晕效果 - 鼠标移动时边框产生渐变光晕
 *
 * 使用方式:
 * <div v-card-spotlight class="relative">卡片</div>
 */
export const vCardSpotlight: Directive<
  HTMLElement,
  {
    color?: string
    borderRadius?: string
  }
> = {
  mounted(el: HTMLElement, binding) {
    const {
      color = 'rgba(236, 72, 153, 0.5)',
      borderRadius = 'inherit',
    } = binding.value || {}

    el.style.position = el.style.position || 'relative'

    // 创建边框光晕元素
    const border = document.createElement('div')
    border.className = 'card-spotlight-border'
    border.style.cssText = `
      position: absolute;
      inset: -1px;
      border-radius: ${borderRadius};
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 0;
    `
    el.insertBefore(border, el.firstChild)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      border.style.background = `radial-gradient(
        400px circle at ${x}px ${y}px,
        ${color},
        transparent 40%
      )`
      border.style.opacity = '1'
    }

    const handleMouseLeave = () => {
      border.style.opacity = '0'
    }

    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', handleMouseLeave)

    ;(el as any)._cardSpotlightCleanup = () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', handleMouseLeave)
      border.remove()
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any)._cardSpotlightCleanup?.()
  },
}

// 导出所有指令
export const animationDirectives: Record<string, AnyDirective> = {
  'stagger-in': vStaggerIn,
  'fade-in': vFadeIn,
  'scale-in': vScaleIn,
  'slide-in': vSlideIn,
  'hover-lift': vHoverLift,
  'parallax': vParallax,
  'scroll-in': vScrollIn,
  'tilt': vTilt,
  'magnetic': vMagnetic,
  'spotlight': vSpotlight,
  'card-spotlight': vCardSpotlight,
}
