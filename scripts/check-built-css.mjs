import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const assets = path.resolve(import.meta.dirname, '../dist/assets')
const files = fs.readdirSync(assets)
for (const prefix of ['desktop-', 'lyric-island-']) {
  const matching = files.filter(
    file => file.startsWith(prefix) && file.endsWith('.css')
  )
  assert.equal(
    matching.length,
    1,
    `Expected one built ${prefix} surface stylesheet.`
  )
  const css = fs.readFileSync(path.join(assets, matching[0]), 'utf8')
  // 当前 WebView 支持标准属性，不接受只有 -webkit- 前缀的声明；必须检查压缩后产物。
  assert.match(
    css,
    /(?:^|[;{])backdrop-filter:\s*blur\(22px\)\s*saturate\((?:1\.25|125%)\)/,
    `${matching[0]} lost the standard backdrop-filter during CSS minification.`
  )
}
console.log(
  'Built desktop CSS verified: standard blur(22px)/saturate declarations survive minification for all native surfaces.'
)
