// 仅为已知平台的无查询参数图片生成缩略图，其他来源保留原地址和签名。
export function coverThumbnail(source: string, pixels: number): string {
  const size = [64, 120, 240, 400, 640].find(edge => edge >= pixels)
  if (!size) return source
  if (/^https?:\/\/p\d+\.music\.126\.net\/[^?#]+\.(?:jpe?g|png|webp)$/i.test(source))
    return source + '?param=' + size + 'y' + size

  const sized = /^(https?:\/\/(?:imge\.kugou\.com\/stdmusic|img\d+\.kuwo\.cn\/star\/albumcover))\/(\d+)\/([^?#]+\.(?:jpe?g|png|webp))$/i.exec(source)
  if (!sized || Number(sized[2]) <= size) return source
  return sized[1] + '/' + size + '/' + sized[3]
}
