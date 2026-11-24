import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// 从仓库根目录读取配置，允许从任意工作目录运行发版检查。
function read(file) {
  return readFileSync(resolve(root, file), 'utf8')
}

const pkg = JSON.parse(read('package.json'))
const config = JSON.parse(read('src-tauri/tauri.conf.json'))
const manifest = read('src-tauri/Cargo.toml').split(/^\[/m).find(section => section.startsWith('package]'))
const lock = read('src-tauri/Cargo.lock').split('[[package]]').find(section => section.includes('\nname = "miraiplayer"'))
const tag = process.argv[2] ?? process.env.RELEASE_TAG
assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, '安装包使用三段数字版本号')
assert(pkg.version.split('.').every(part => Number(part) <= 65535), 'Windows 安装版本号超出范围')
assert.equal(config.version, '../package.json', '桌面版本应读取 package.json')
assert.equal(manifest?.match(/^version = "([^"]+)"/m)?.[1], pkg.version, 'Cargo.toml 版本不一致')
assert.equal(lock?.match(/^version = "([^"]+)"/m)?.[1], pkg.version, 'Cargo.lock 版本不一致')
assert.equal(config.bundle.publisher, pkg.author)
assert.equal(config.bundle.homepage, pkg.homepage)
if (tag) assert.equal(tag, 'v' + pkg.version, '版本标签与应用版本不一致')
console.log(config.productName, pkg.version, '· 发行信息一致')
