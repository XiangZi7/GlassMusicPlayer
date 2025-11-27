/**
 * @description 获取浏览器默认语言
 * @returns {String}
 */
export function getBrowserLang(): string {
  const browserLang = navigator.language
  const l = browserLang.toLowerCase()
  if (['cn', 'zh', 'zh-cn', 'zh-hans'].includes(l)) return 'zh'
  if (['ja', 'ja-jp'].includes(l)) return 'ja'
  return 'en'
}
