import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReleaseTag } from './release-version.mjs'

// 从已验签的 minisign 注释中读取唯一的版本字段，确保安装包可用于当前发行标签。
export function checkSignedVersion(tag, trustedComment) {
  const { version } = parseReleaseTag(tag)
  const fields = trustedComment.replace(/\r?\n$/, '').split('\t').filter(field => field.startsWith('version:'))
  if (fields.length !== 1 || fields[0] !== 'version:' + version) {
    throw new Error('更新包签名中的版本与发行标签不匹配 ' + tag)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [tag, publicKeyFile, signatureFile, payload] = process.argv.slice(2)
  // -Q 在文件和注释的签名均有效时输出可信注释，-H 要求 Tauri 的预哈希签名。
  const comment = execFileSync('minisign', ['-V', '-H', '-Q', '-p', publicKeyFile, '-x', signatureFile, '-m', payload], {
    encoding: 'utf8',
  })
  checkSignedVersion(tag, comment)
}
