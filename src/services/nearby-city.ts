import cityTableUrl from '@/assets/weather-cities.json?url'

// GeoNames 城市中心按整纬度分桶。匹配范围限制为四十公里，海上与偏远地区可留空。
type CityTable = Record<string, [number, number, string][]>
let cityTable: Promise<CityTable> | undefined
const radians = Math.PI / 180
const maxDistance = Math.sin(40 / (2 * 6371)) ** 2

// 首次展示天气时读取安装包内的固定资源；共享同一份解析结果，失败可重试。
function loadCityTable(): Promise<CityTable> {
  cityTable ??= fetch(cityTableUrl, { credentials: 'omit' })
    .then(response => {
      if (!response.ok) throw new Error('本地城市表不可用')
      return response.json() as Promise<CityTable>
    })
    .catch(error => {
      cityTable = undefined
      throw error
    })
  return cityTable
}

// 以球面距离匹配最近的收录地名，跨越日期变更线时仍按较短的弧计算。
export async function findNearbyCity(
  latitude: number,
  longitude: number
): Promise<string | undefined> {
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180
  ) return
  const cities = await loadCityTable()
  let closest = maxDistance
  let name: string | undefined
  const band = Math.floor(latitude)
  const cosLatitude = Math.cos(latitude * radians)
  for (let index = band - 1; index <= band + 1; index++) {
    for (const [lat, lon, label] of cities[index] ?? []) {
      const distance = Math.sin((lat - latitude) * radians / 2) ** 2 +
        cosLatitude * Math.cos(lat * radians) * Math.sin((lon - longitude) * radians / 2) ** 2
      if (distance < closest) {
        closest = distance
        name = label
      }
    }
  }
  return name
}
