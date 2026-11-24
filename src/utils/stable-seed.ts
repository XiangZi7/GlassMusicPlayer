// 将账号、日期或曲目标识转换为稳定的无符号种子，排序不依赖本次启动时间。
export function metaSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  }
  return hash >>> 0
}
