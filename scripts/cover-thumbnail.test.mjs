import assert from 'node:assert/strict'
import test from 'node:test'
import { coverThumbnail } from '../src/services/player/cover-thumbnail.ts'

test('列表和高密度屏按显示尺寸选用平台支持的封面', () => {
  const netease = 'https://p2.music.126.net/abc/1.jpg'
  const kugou = 'https://imge.kugou.com/stdmusic/400/20260304/song.jpg'
  const kuwo = 'https://img4.kuwo.cn/star/albumcover/500/s4/cover.jpg'
  assert.equal(coverThumbnail(netease, 48), netease + '?param=64y64')
  assert.equal(coverThumbnail(netease, 96), netease + '?param=120y120')
  assert.equal(coverThumbnail(kugou, 152), kugou.replace('/400/', '/240/'))
  assert.equal(coverThumbnail(kuwo, 304), kuwo.replace('/500/', '/400/'))
  assert.equal(coverThumbnail(kugou, 500), kugou)
})

test('本地图、未知来源、签名链接和已有裁切保持原样', () => {
  for (const source of [
    '/images/music-placeholder.svg',
    'blob:https://player.local/1',
    'https://p2.music.126.net/abc/1.jpg?token=signed',
    'https://p2.music.126.net/abc/1.jpg?param=80y80',
    'https://imge.kugou.com/stdmusic/400/cover.jpg?sign=1',
    'https://img4.kuwo.cn/other/500/cover.jpg',
    'https://p2.music.126.net.example.org/cover.jpg',
  ]) assert.equal(coverThumbnail(source, 48), source)
})
