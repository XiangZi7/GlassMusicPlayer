import {
  computed,
  onScopeDispose,
  reactive,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import { invoke, isTauri } from '@tauri-apps/api/core'
import {
  buildLocalWeatherUrl,
  isWeatherFresh,
  parseCurrentWeather,
  validateLocalWeather,
  WEATHER_MAX_AGE_MS,
  type LocalWeatherData,
} from '@/services/local-weather'

export const WEATHER_REFRESH_MS = 15 * 60_000
export const WEATHER_TIMEOUT_MS = 8_000

type Timer = ReturnType<typeof setTimeout>
type WeatherListener = (weather: LocalWeatherData | null) => void
type WeatherPermission = Pick<
  PermissionStatus,
  'state' | 'addEventListener' | 'removeEventListener'
>

export interface WeatherDependencies {
  nearbyCity: (lat: number, lon: number) => Promise<string | undefined>
  resetPermission: (() => Promise<unknown>) | null
  geolocation: Pick<Geolocation, 'getCurrentPosition'> | null
  permissions: Pick<Permissions, 'query'> | null
  fetch:
    | ((
        url: string,
        options: RequestInit
      ) => Promise<Pick<Response, 'ok' | 'json'>>)
    | null
  now: () => number
  setTimer: (callback: () => void, delay: number) => Timer
  clearTimer: (timer: Timer) => void
}

export interface WeatherSnapshot {
  readonly lastAttempt: number | null
  readonly weather: LocalWeatherData | null
}

export interface LocalWeatherClient {
  readonly problem: Readonly<Ref<string>>
  readonly retrying: Readonly<Ref<boolean>>
  subscribe: (listener: WeatherListener) => () => void
  refresh: () => void
  dispose: () => void
  snapshot: () => WeatherSnapshot
}

// 某些 WebView 的能力属性会抛错，不能让天气模块导入失败拖垮音乐界面。
function browserLocation(): Pick<
  WeatherDependencies,
  'geolocation' | 'permissions'
> {
  let geolocation: WeatherDependencies['geolocation'] = null
  let permissions: WeatherDependencies['permissions'] = null
  if (typeof navigator !== 'undefined') {
    try {
      geolocation = navigator.geolocation ?? null
    } catch {
      // 不支持/无宿主权限时保持隐藏，不猜测替代位置。
    }
    try {
      permissions = navigator.permissions ?? null
    } catch {
      // 缺少 Permissions API 时，只以原生定位成功回调作为授权依据。
    }
  }
  return { geolocation, permissions }
}

// 可注入的一次定位驱动；VueUse useGeolocation 是持续 watchPosition，不符合这里的边界。
// 缓存只在内存保留窄天气/节流时间，位置和 URL 仅用于当次请求，不输出日志。
export function createLocalWeatherClient(
  dependencies: Partial<WeatherDependencies> = {},
  initial?: WeatherSnapshot
): LocalWeatherClient {
  const deps: WeatherDependencies = {
    ...browserLocation(),
    // 仅在天气可用时加载打包的离线城市表，地点不会随任何新增请求发出。
    nearbyCity: async (lat, lon) =>
      (await import('@/services/nearby-city')).findNearbyCity(lat, lon),
    resetPermission:
      typeof window !== 'undefined' && isTauri()
        ? () => invoke('reset_location_permission')
        : null,
    fetch:
      typeof globalThis.fetch === 'function'
        ? globalThis.fetch.bind(globalThis)
        : null,
    now: Date.now,
    setTimer: (callback, delay) => setTimeout(callback, delay),
    clearTimer: timer => clearTimeout(timer),
    ...dependencies,
  }
  const listeners = new Set<WeatherListener>()
  // 对外只公布失败类别，不暴露坐标、请求 URL 或原始错误。
  const problem = ref('')
  // 主动重试期间保留原位按钮，重复点击共享同一次请求。
  const retrying = ref(false)
  const initialNow = deps.now()
  let lastAttempt =
    typeof initial?.lastAttempt === 'number' &&
    Number.isFinite(initial.lastAttempt) &&
    initial.lastAttempt > 0 &&
    initial.lastAttempt <= initialNow
      ? initial.lastAttempt
      : null
  let cached = validateLocalWeather(initial?.weather, initialNow)
  let published: LocalWeatherData | null = null
  let timer: Timer | null = null
  let active: AbortController | null = null
  let generation = 0
  let retryGeneration = 0
  let disposed = false
  let permissionChecked = false
  let permissionStatus: WeatherPermission | null = null
  let permissionPaused = false
  let authorizedByLocation = false

  const subscribed = () => !disposed && listeners.size > 0
  const capable = () =>
    typeof deps.geolocation?.getCurrentPosition === 'function' &&
    typeof deps.fetch === 'function' &&
    typeof AbortController === 'function'
  const owns = (id: number, controller: AbortController) =>
    id === generation && active === controller
  const current = (id: number, controller: AbortController) =>
    subscribed() && owns(id, controller) && !controller.signal.aborted

  function clearTimer(): void {
    if (timer !== null) deps.clearTimer(timer)
    timer = null
  }

  function notify(
    listener: WeatherListener,
    weather: LocalWeatherData | null
  ): void {
    try {
      listener(weather)
    } catch {
      // 订阅者的异常不能阻止其他订阅或资源清理，也不记录含位置的错误。
    }
  }

  function publish(weather: LocalWeatherData | null): void {
    if (published === weather) return
    published = weather
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) notify(listener, weather)
    }
  }

  function clearWeather(): void {
    cached = null
    publish(null)
  }

  function visibleWeather(): LocalWeatherData | null {
    if (
      !capable() ||
      !permissionChecked ||
      permissionPaused ||
      active ||
      (!authorizedByLocation && permissionStatus?.state !== 'granted')
    )
      return null
    return cached && isWeatherFresh(cached, deps.now()) ? cached : null
  }

  // 原生一次定位无法取消系统操作；立即结算并清理计时/监听，晚回调不再触发后续阶段。
  // fetch + json 共享整体 8 秒 deadline，即使 mock/宿主忽略 abort 也不会复活。
  function cancellable<T>(
    controller: AbortController,
    begin: (resolve: (value: T) => void, reject: () => void) => void
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false
      let deadline: Timer | null = null
      function finish(value: T | null, failed: boolean): void {
        if (settled) return
        settled = true
        if (deadline !== null) deps.clearTimer(deadline)
        controller.signal.removeEventListener('abort', abort)
        if (failed) reject(new Error('Local weather unavailable'))
        else resolve(value as T)
      }
      function abort(): void {
        finish(null, true)
      }
      if (controller.signal.aborted) {
        abort()
        return
      }
      controller.signal.addEventListener('abort', abort, { once: true })
      deadline = deps.setTimer(() => controller.abort(), WEATHER_TIMEOUT_MS)
      try {
        begin(value => finish(value, false), abort)
      } catch {
        abort()
      }
    })
  }

  function cancelRequest(): void {
    generation++
    clearTimer()
    const controller = active
    active = null
    controller?.abort()
  }

  function stop(): void {
    retryGeneration++
    cancelRequest()
    retrying.value = false
    permissionStatus?.removeEventListener('change', permissionChanged)
    permissionStatus = null
    permissionChecked = false
    permissionPaused = false
    authorizedByLocation = false
    published = null
  }

  function permissionChanged(): void {
    if (!subscribed()) return
    if (permissionStatus?.state === 'granted') {
      problem.value = ''
      permissionPaused = false
      // 原生授权弹窗同意期间的请求仍然有效，不为 change 再启动一份定位。
      if (!active) {
        lastAttempt = null
        reconcile()
      }
      return
    }
    // 已拒绝或已撤销到 prompt 时立即隐藏，并且不自动再次弹出授权请求。
    permissionPaused = true
    problem.value = '定位未授权'
    authorizedByLocation = false
    cancelRequest()
    clearWeather()
  }

  // 不使用自动查询且不可取消的 usePermission：此查询必须和共享驱动一起结算/清理。
  async function checkPermission(): Promise<void> {
    const id = ++generation
    const controller = new AbortController()
    active = controller
    try {
      const status = await cancellable<PermissionStatus | null>(
        controller,
        (resolve, reject) => {
          const permissions = deps.permissions
          if (!permissions) {
            resolve(null)
            return
          }
          void permissions
            .query({ name: 'geolocation' })
            .then(resolve, () => resolve(null))
          if (!current(id, controller)) reject()
        }
      )
      if (!current(id, controller)) return
      if (
        status &&
        ['granted', 'prompt', 'denied'].includes(status.state) &&
        typeof status.addEventListener === 'function' &&
        typeof status.removeEventListener === 'function'
      ) {
        permissionStatus = status
        status.addEventListener('change', permissionChanged)
        permissionPaused = status.state === 'denied'
        if (permissionPaused) {
          problem.value = '定位未授权'
          clearWeather()
        }
      }
    } catch {
      // Permissions API 缺失/抛错仍可尝试原生定位；查询超时则本轮明确隐藏。
      if (owns(id, controller) && controller.signal.aborted) {
        problem.value = '定位暂不可用'
        lastAttempt = deps.now()
      }
    } finally {
      if (owns(id, controller)) {
        permissionChecked = true
        active = null
        reconcile()
      }
    }
  }

  function reconcile(): void {
    clearTimer()
    if (!subscribed()) return
    const now = deps.now()
    if (!capable() || !Number.isFinite(now) || now <= 0) {
      problem.value = '定位暂不可用'
      clearWeather()
      return
    }
    if (cached && !isWeatherFresh(cached, now)) clearWeather()
    if (!subscribed() || active) return
    if (!permissionChecked) {
      if (deps.permissions) {
        void checkPermission()
        return
      }
      permissionChecked = true
    }
    if (permissionPaused) return
    // 系统时钟回退最多等待一个刷新周期，不能构造 Infinity/负值计时器。
    if (lastAttempt !== null && lastAttempt > now) lastAttempt = now
    const remaining =
      lastAttempt === null
        ? 0
        : Math.max(0, lastAttempt + WEATHER_REFRESH_MS - now)
    if (remaining === 0) {
      void request()
      return
    }
    publish(visibleWeather())
    if (!subscribed() || active) return
    const expiresIn = cached
      ? cached.observedAt + WEATHER_MAX_AGE_MS - now
      : remaining
    timer = deps.setTimer(
      reconcile,
      Math.max(1, Math.min(remaining, expiresIn))
    )
  }

  // 本地匹配独立于天气显示，取消或移动后丢弃旧观测的地名。
  async function attachCity(weather: LocalWeatherData, lat: number, lon: number): Promise<void> {
    const id = generation
    try {
      const city = await deps.nearbyCity(lat, lon)
      if (city && id === generation && subscribed() && cached === weather) {
        cached = { ...weather, nearbyCity: city }
        publish(visibleWeather())
      }
    } catch {
      // 本地资源加载失败时仍显示有效天气。
    }
  }

  // 一次定位刷新天气，使用同一位置在本地补上附近城市名。
  async function request(): Promise<void> {
    if (!subscribed() || active || permissionPaused || !capable()) return
    const id = ++generation
    const controller = new AbortController()
    active = controller
    lastAttempt = deps.now()
    problem.value = ''
    let located = false
    clearWeather()
    try {
      const geolocation = deps.geolocation
      const fetchWeather = deps.fetch
      if (!current(id, controller) || !geolocation || !fetchWeather) return
      const position = await cancellable<GeolocationPosition>(
        controller,
        (resolve, reject) => {
          geolocation.getCurrentPosition(
            resolve,
            error => {
              // WebView 的宿主拒绝未必体现在 Permissions API，原生 code=1 也必须停用重试。
              if (current(id, controller) && error.code === 1)
                permissionPaused = true
              reject()
            },
            {
              enableHighAccuracy: false,
              maximumAge: 0,
              timeout: WEATHER_TIMEOUT_MS,
            }
          )
        }
      )
      if (!current(id, controller)) return
      const url = buildLocalWeatherUrl(position, deps.now())
      if (!url) {
        problem.value = '定位暂不可用'
        return
      }
      located = true
      authorizedByLocation = true
      const payload = await cancellable<unknown>(
        controller,
        (resolve, reject) => {
          void fetchWeather(url, {
            signal: controller.signal,
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            redirect: 'error',
          })
            .then(async response => {
              // 取消后到达的 HTTP 响应连 JSON 都不读取，避免延长无意义的后台工作。
              if (!current(id, controller) || response.ok !== true)
                throw new Error('Local weather unavailable')
              return response.json()
            })
            .then(resolve, reject)
        }
      )
      if (!current(id, controller)) return
      cached = parseCurrentWeather(payload, deps.now())
      if (cached) void attachCity(cached, position.coords.latitude, position.coords.longitude)
      else problem.value = '天气暂不可用'
    } catch {
      // 只显示失败类别，绝不输出 URL、位置或原始错误。
      if (owns(id, controller) && subscribed()) {
        problem.value = permissionPaused
          ? '定位未授权'
          : located
            ? '天气暂不可用'
            : '定位暂不可用'
        clearWeather()
      }
    } finally {
      if (owns(id, controller)) {
        active = null
        reconcile()
      }
    }
  }

  // 由用户点击触发一次定位，可重新唤起系统询问；后台轮询始终尊重拒绝。
  async function retry(): Promise<void> {
    if (!subscribed() || active || retrying.value) return
    const attempt = ++retryGeneration
    retrying.value = true
    try {
      if (permissionPaused && deps.resetPermission) {
        try {
          await deps.resetPermission()
        } catch {
          /* 仍通过宿主定位确认当前授权。 */
        }
        if (!subscribed() || attempt !== retryGeneration || !permissionPaused)
          return
      }
      if (!subscribed() || active) return
      permissionPaused = false
      lastAttempt = null
      clearTimer()
      clearWeather()
      if (capable()) await request()
      else reconcile()
    } finally {
      if (attempt === retryGeneration) retrying.value = false
    }
  }

  return {
    problem,
    retrying,
    subscribe(listener) {
      if (disposed) {
        notify(listener, null)
        return () => {}
      }
      // 每次订阅独立且取消幂等，即使调用方复用同一个回调也不会互相释放。
      const subscription: WeatherListener = weather => listener(weather)
      listeners.add(subscription)
      notify(subscription, visibleWeather())
      reconcile()
      let listening = true
      return () => {
        if (!listening) return
        listening = false
        listeners.delete(subscription)
        if (listeners.size === 0) stop()
      }
    },
    refresh: retry,
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      cached = null
      for (const listener of [...listeners]) notify(listener, null)
      listeners.clear()
    },
    snapshot: () => ({
      lastAttempt,
      weather: validateLocalWeather(cached, deps.now()),
    }),
  }
}

// 跨组件重挂共享节流；HMR 仅继承不含位置的快照，旧模块先取消所有副作用。
const sharedClient = createLocalWeatherClient(
  {},
  import.meta.hot?.data.localWeatherSnapshot
)
if (import.meta.hot) {
  import.meta.hot.dispose(data => {
    data.localWeatherSnapshot = sharedClient.snapshot()
    sharedClient.dispose()
  })
}

export function useLocalWeather(
  enabled: MaybeRefOrGetter<boolean>,
  client: LocalWeatherClient = sharedClient
) {
  // 响应式状态
  const state = reactive({
    // 仅保存已经通过定位、网络及新鲜度校验的真实天气。
    weather: null as LocalWeatherData | null,
  })
  let disposed = false
  const stopWatch = watch(
    () => toValue(enabled),
    (visible, _previous, onCleanup) => {
      state.weather = null
      if (!visible) return
      let listening = true
      let unsubscribe: (() => void) | undefined
      // 先注册清理，连 subscribe 同步回调中发生的禁用/卸载也不会遗漏取消。
      onCleanup(() => {
        listening = false
        unsubscribe?.()
        state.weather = null
      })
      unsubscribe = client.subscribe(weather => {
        if (!disposed && listening && toValue(enabled)) state.weather = weather
      })
      if (!listening) unsubscribe()
    },
    { immediate: true, flush: 'sync' }
  )
  onScopeDispose(() => {
    disposed = true
    stopWatch()
  })
  return {
    problem: client.problem,
    retrying: client.retrying,
    weather: computed(() => (toValue(enabled) ? state.weather : null)),
    refresh: () => {
      if (!disposed && toValue(enabled)) client.refresh()
    },
  }
}
