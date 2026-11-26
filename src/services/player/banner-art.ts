import { useLocalStorage } from '@vueuse/core'
import type { RemovableRef } from '@vueuse/core'

// 首页横幅人物选项（数据驱动）：设置页的分段控件只读这份列表。
// 后续新增内置人物时，只在这里加一项 { value, label}、把整套素材
// （整图 + bg/chara/coverage/dots 四件）放进 public/images，并在下方素材映射表
// bannerArtAssets 里补同一 value 的一条记录即可，设置页结构与存储逻辑都不用再动。
export const bannerArtOptions: { value: string; label: string }[] = [
  { value: 'original', label: '原始人物' },
  { value: 'mirai-blade', label: '栗山未来 · 血刃' },
  { value: 'pinkwave', label: '粉发波浪' },
  { value: 'tealtwin', label: '青蓝双马尾' },
  { value: 'whitehair', label: '白发' },
  { value: 'minttwin', label: '薄荷双马尾' },
  { value: 'custom', label: '自定义上传' },
]

// 校验存量的人物选择值：选项下线后旧值（如已撤下的 'mirai'）不再可达，
// 统一回退原始人物，避免横幅空白或设置页无卡选中；store 初始化恢复偏好时调用。
export function normalizeBannerCharacter(value: string): string {
  return bannerArtOptions.some((option) => option.value === value)
    ? value
    : 'original'
}

// 一套内置人物的横幅素材：整图供静态展示，三层素材（干净底/人物/覆盖场）供
// three 点阵合成，提取点层供同位点引擎；尺寸与裁切位置按各自原图实测，不通用。
export interface BannerArtAssets {
  /** 横幅整图路径（静态与回退展示）。 */
  art: string
  /** three 合成的干净背景层。 */
  bg: string
  /** three 合成的人物层（带透明通道）。 */
  chara: string
  /** three 合成的覆盖场纹理（半分辨率）。 */
  coverage: string
  /** 同位点引擎的提取点层（与整图逐像素同源）。 */
  dots: string
  /** 素材原生宽（图像空间口径，shader 与画布裁切共用）。 */
  width: number
  /** 素材原生高。 */
  height: number
  /** 展开态 cover 裁切横向位置（0–1 分数，下同）。 */
  posX: number
  /** 展开态 cover 裁切纵向位置。 */
  posY: number
  /** 窄窗（≤700px）裁切横向位置。 */
  posXNarrow: number
  /** 折叠迷你条裁切横向位置。 */
  posCompactX: number
  /** 折叠迷你条裁切纵向位置，按人物眼睛带实测让眼睛落条中线。 */
  posCompactY: number
}

// 内置人物素材映射表：与上方选项列表以 value 对应（'custom' 无内置素材，不入表）。
export const bannerArtAssets: Record<string, BannerArtAssets> = {
  original: {
    art: '/images/pop-hero.webp',
    bg: '/images/pop-hero-bg.webp',
    chara: '/images/pop-hero-chara.webp',
    coverage: '/images/pop-hero-coverage.webp',
    dots: '/images/pop-hero-dots.webp',
    width: 2736,
    height: 912,
    posX: 0.62,
    posY: 0.36,
    posXNarrow: 0.88,
    posCompactX: 0.5,
    posCompactY: 0.36,
  },
  'mirai-blade': {
    art: '/images/pop-hero-mirai-blade.webp',
    bg: '/images/pop-hero-mirai-blade-bg.webp',
    chara: '/images/pop-hero-mirai-blade-chara.webp',
    coverage: '/images/pop-hero-mirai-blade-coverage.webp',
    dots: '/images/pop-hero-mirai-blade-dots.webp',
    width: 2640,
    height: 864,
    // 眼睛实测在 (0.71, 0.28)：正面脸比侧脸版高，展开纵向取 0.30，
    // 迷你条纵向取 0.28 让眼睛落中线；窄窗横向 0.86 把正脸收进框内。
    posX: 0.68,
    posY: 0.3,
    posXNarrow: 0.86,
    posCompactX: 0.5,
    posCompactY: 0.28,
  },
  pinkwave: {
    art: '/images/pop-hero-pinkwave.webp',
    bg: '/images/pop-hero-pinkwave-bg.webp',
    chara: '/images/pop-hero-pinkwave-chara.webp',
    coverage: '/images/pop-hero-pinkwave-coverage.webp',
    dots: '/images/pop-hero-pinkwave-dots.webp',
    width: 2736,
    height: 912,
    // 眼睛实测在 (0.64, 0.37)：三分之四侧脸比正侧脸更靠中，展开横向取 0.60
    // 保整张脸入框，迷你条纵向取 0.35 让眼睛落中线。
    posX: 0.6,
    posY: 0.35,
    posXNarrow: 0.84,
    posCompactX: 0.5,
    posCompactY: 0.35,
  },
  tealtwin: {
    art: '/images/pop-hero-tealtwin.webp',
    bg: '/images/pop-hero-tealtwin-bg.webp',
    chara: '/images/pop-hero-tealtwin-chara.webp',
    coverage: '/images/pop-hero-tealtwin-coverage.webp',
    dots: '/images/pop-hero-tealtwin-dots.webp',
    width: 2736,
    height: 912,
    // 眼睛实测在 (0.71, 0.40)：展开略右移保脸入框，迷你条纵向取 0.39 让眼睛落中线。
    posX: 0.67,
    posY: 0.39,
    posXNarrow: 0.85,
    posCompactX: 0.5,
    posCompactY: 0.39,
  },
  whitehair: {
    art: '/images/pop-hero-whitehair.webp',
    bg: '/images/pop-hero-whitehair-bg.webp',
    chara: '/images/pop-hero-whitehair-chara.webp',
    coverage: '/images/pop-hero-whitehair-coverage.webp',
    dots: '/images/pop-hero-whitehair-dots.webp',
    width: 2640,
    height: 864,
    // 眼睛实测在 (0.71, 0.40)：与原始人物同构图（侧脸居右、点阵在右上），
    // 展开横向取 0.65，迷你条纵向取 0.39 让眼睛落中线。
    posX: 0.65,
    posY: 0.39,
    posXNarrow: 0.85,
    posCompactX: 0.5,
    posCompactY: 0.39,
  },
  minttwin: {
    art: '/images/pop-hero-minttwin.webp',
    bg: '/images/pop-hero-minttwin-bg.webp',
    chara: '/images/pop-hero-minttwin-chara.webp',
    coverage: '/images/pop-hero-minttwin-coverage.webp',
    dots: '/images/pop-hero-minttwin-dots.webp',
    width: 2640,
    height: 864,
    // 眼睛实测在 (0.70, 0.41)：双马尾向右上展开，展开横向取 0.65 保脸与
    // 马尾入框，迷你条纵向取 0.40 让眼睛落中线。
    posX: 0.65,
    posY: 0.4,
    posXNarrow: 0.85,
    posCompactX: 0.5,
    posCompactY: 0.4,
  },
}

// 自定义横幅图独立存放在本机存储：图片数据远超偏好设置的单值上限，
// 不进 preferences 的设置白名单；选择本身走 settings.bannerCharacter 同步。
export const customBannerArtKey = 'miraiMusic.bannerArt.v1'

// 自定义横幅图的共享引用：设置页写入、首页横幅读取，跨窗口靠存储事件同步
// （与灵动岛偏好 useLocalStorage 的既有通路一致）。
export const customBannerArt: RemovableRef<string> = useLocalStorage(
  customBannerArtKey,
  ''
)

// 把用户图片等比压到横幅够用的尺寸再存：长边上限 2048，WebP 优先，
// 控制本机存储占用，避免原图动辄数 MB 撑爆配额。
const MAX_EDGE = 2048
// 压缩后仍超长时再降一档的长边与可接受的数据长度上限（约 1.6MB 文本）。
const FALLBACK_EDGE = 1280
const MAX_DATA_LENGTH = 1_600_000

// 解码用户选择的图片文件，失败时给出可读原因而不是静默吞掉。
async function decodeImage(
  file: File
): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      /* 个别格式 createImageBitmap 不认时回退到 Image 元素解码。 */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 按长边上限等比缩放绘制到画布并编码为数据地址；格式不支持 WebP 时回退 JPEG。
function encodeScaled(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  maxEdge: number,
  quality: number
): string {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境无法处理图片。')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL('image/webp', quality)
  return webp.startsWith('data:image/webp')
    ? webp
    : canvas.toDataURL('image/jpeg', quality)
}

// 保存用户自定义横幅图：压缩后写入本机存储并返回数据地址，写入失败如实抛出。
export async function saveCustomBannerArt(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  const bitmap = await decodeImage(file).catch(() => {
    throw new Error('无法读取这张图片，请换一张试试。')
  })
  const width =
    bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width
  const height =
    bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height
  if (!width || !height) throw new Error('无法读取这张图片，请换一张试试。')
  let data = encodeScaled(bitmap, width, height, MAX_EDGE, 0.85)
  if (data.length > MAX_DATA_LENGTH)
    data = encodeScaled(bitmap, width, height, FALLBACK_EDGE, 0.8)
  if (data.length > MAX_DATA_LENGTH)
    throw new Error('这张图片压缩后仍然过大，请换一张小一点的图片。')
  // 先直写本机存储确认配额足够，再更新共享引用触发各窗口同步。
  try {
    localStorage.setItem(customBannerArtKey, data)
  } catch {
    throw new Error('保存失败，本机存储空间可能不足。')
  }
  customBannerArt.value = data
  return data
}

// 移除自定义横幅图：只清图片数据，选择仍停留在“自定义上传”时横幅回退原始人物。
export function clearCustomBannerArt(): void {
  try {
    localStorage.removeItem(customBannerArtKey)
  } catch {
    /* 存储不可用时仍清共享引用，界面立即回退。 */
  }
  customBannerArt.value = ''
}
