export type FullscreenTitleClass = '' | 't-mid' | 't-long' | 't-xlong'

// 原稿的中英文加权长度与三个阈值，字号由全屏页的响应式 CSS 决定。
export function fullscreenTitleClass(title: string): FullscreenTitleClass {
  let weight = 0
  for (let index = 0; index < title.length; index++)
    weight += title.charCodeAt(index) > 255 ? 1 : 0.55
  return weight > 26
    ? 't-xlong'
    : weight > 18
      ? 't-long'
      : weight > 11
        ? 't-mid'
        : ''
}
