// Open-Meteo 当前天气的窄数据契约；可选地名由设备离线匹配，不保留经纬度或完整响应。
export type WeatherIcon =
  | 'sun'
  | 'moon'
  | 'partly-day'
  | 'partly-night'
  | 'cloud'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'thunder'

export interface WeatherDescription {
  readonly label: string
  readonly icon: WeatherIcon
}

export interface LocalWeatherData extends WeatherDescription {
  readonly nearbyCity?: string
  readonly temperatureCelsius: number
  readonly weatherCode: number
  readonly isDay: boolean
  readonly observedAt: number
}

export const WEATHER_MAX_AGE_MS = 30 * 60_000
export const WEATHER_MAX_LOCATION_AGE_MS = 15 * 60_000
const MAX_FUTURE_MS = 5 * 60_000

// WMO 4677：只接受 API 定义的天气代码，不把未知代码伪装成晴天。
export function describeWeather(
  code: number,
  isDay: boolean
): WeatherDescription | null {
  const partly: WeatherIcon = isDay ? 'partly-day' : 'partly-night'
  switch (code) {
    case 0:
      return { label: '晴', icon: isDay ? 'sun' : 'moon' }
    case 1:
      return { label: '晴间多云', icon: partly }
    case 2:
      return { label: '多云', icon: partly }
    case 3:
      return { label: '阴', icon: 'cloud' }
    case 45:
      return { label: '雾', icon: 'fog' }
    case 48:
      return { label: '冻雾', icon: 'fog' }
    case 51:
      return { label: '小毛毛雨', icon: 'rain' }
    case 53:
      return { label: '毛毛雨', icon: 'rain' }
    case 55:
      return { label: '强毛毛雨', icon: 'rain' }
    case 56:
      return { label: '冻毛毛雨', icon: 'rain' }
    case 57:
      return { label: '强冻毛毛雨', icon: 'rain' }
    case 61:
      return { label: '小雨', icon: 'rain' }
    case 63:
      return { label: '中雨', icon: 'rain' }
    case 65:
      return { label: '大雨', icon: 'rain' }
    case 66:
      return { label: '冻雨', icon: 'rain' }
    case 67:
      return { label: '强冻雨', icon: 'rain' }
    case 71:
      return { label: '小雪', icon: 'snow' }
    case 73:
      return { label: '中雪', icon: 'snow' }
    case 75:
      return { label: '大雪', icon: 'snow' }
    case 77:
      return { label: '雪粒', icon: 'snow' }
    case 80:
      return { label: '小阵雨', icon: 'rain' }
    case 81:
      return { label: '阵雨', icon: 'rain' }
    case 82:
      return { label: '强阵雨', icon: 'rain' }
    case 85:
      return { label: '阵雪', icon: 'snow' }
    case 86:
      return { label: '强阵雪', icon: 'snow' }
    case 95:
      return { label: '雷雨', icon: 'thunder' }
    case 96:
      return { label: '雷雨冰雹', icon: 'thunder' }
    case 99:
      return { label: '强雷雨冰雹', icon: 'thunder' }
    default:
      return null
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isWeatherFresh(
  weather: LocalWeatherData,
  now: number
): boolean {
  return (
    finite(now) &&
    now > 0 &&
    Number.isSafeInteger(weather.observedAt) &&
    weather.observedAt > 0 &&
    now - weather.observedAt < WEATHER_MAX_AGE_MS &&
    weather.observedAt - now <= MAX_FUTURE_MS
  )
}

// HMR/内存快照也必须重新验证，并重建窄数据，不能继承坐标或任意显示文案。
export function validateLocalWeather(
  value: unknown,
  now: number = Date.now()
): LocalWeatherData | null {
  if (!record(value)) return null
  if (
    !finite(value.temperatureCelsius) ||
    value.temperatureCelsius < -100 ||
    value.temperatureCelsius > 70 ||
    !finite(value.weatherCode) ||
    !Number.isInteger(value.weatherCode) ||
    typeof value.isDay !== 'boolean' ||
    !finite(value.observedAt)
  )
    return null
  const description = describeWeather(value.weatherCode, value.isDay)
  if (!description) return null
  const weather: LocalWeatherData = {
    ...description,
    temperatureCelsius: value.temperatureCelsius,
    weatherCode: value.weatherCode,
    isDay: value.isDay,
    observedAt: value.observedAt,
  }
  return isWeatherFresh(weather, now) ? Object.freeze(weather) : null
}

// 请求使用 timeformat=unixtime，避免 timezone=auto 的无偏移本地日期被宿主时区误读。
export function parseCurrentWeather(
  payload: unknown,
  now: number = Date.now()
): LocalWeatherData | null {
  if (!record(payload) || !record(payload.current)) return null
  if (!record(payload.current_units)) return null
  const current = payload.current
  const units = payload.current_units
  if (units.temperature_2m !== '°C' || units.time !== 'unixtime') return null
  if (
    (current.is_day !== 0 && current.is_day !== 1) ||
    !finite(current.time) ||
    !Number.isSafeInteger(current.time)
  )
    return null

  return validateLocalWeather(
    {
      temperatureCelsius: current.temperature_2m,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      observedAt: current.time * 1_000,
    },
    now
  )
}

// 纯定位验证/协议组装，不调用定位、不持久化；唯一坐标来源必须是本次原生结果。
export function buildLocalWeatherUrl(
  position: unknown,
  now: number = Date.now()
): string | null {
  if (!record(position) || !record(position.coords) || !finite(now) || now <= 0)
    return null
  const { latitude, longitude } = position.coords
  if (
    !finite(latitude) ||
    Math.abs(latitude) > 90 ||
    !finite(longitude) ||
    Math.abs(longitude) > 180 ||
    !finite(position.timestamp) ||
    position.timestamp <= 0 ||
    now - position.timestamp >= WEATHER_MAX_LOCATION_AGE_MS ||
    position.timestamp - now > MAX_FUTURE_MS
  )
    return null

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  // 额外舍入到约一公里网格；不返回或缓存原生定位的精确坐标。
  url.search = new URLSearchParams({
    latitude: String(Math.round(latitude * 100) / 100),
    longitude: String(Math.round(longitude * 100) / 100),
    current: 'temperature_2m,weather_code,is_day',
    timezone: 'auto',
    timeformat: 'unixtime',
    temperature_unit: 'celsius',
  }).toString()
  return url.toString()
}

export function formatWeatherTemperature(temperature: number): string {
  // 避免接近零度时显示负零；界面只显示摄氏整数，原数据保持未舍入。
  const rounded = Math.round(temperature)
  return `${Object.is(rounded, -0) ? 0 : rounded}°`
}
