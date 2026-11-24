import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { syncReleaseVersion } from './release-version.mjs'

const root = resolve(import.meta.dirname, '..')
// 从仓库根目录读取配置，允许从任意工作目录运行发版检查。
function read(file) {
  return readFileSync(resolve(root, file), 'utf8')
}

const pkg = JSON.parse(read('package.json'))
const config = JSON.parse(read('src-tauri/tauri.conf.json'))
const tag = process.argv[2] ?? process.env.RELEASE_TAG
syncReleaseVersion(root, tag || undefined, { check: true })
assert.equal(config.bundle.publisher, pkg.author)
assert.equal(config.bundle.homepage, pkg.homepage)
console.log(config.productName, pkg.version, '· 发行信息一致')
