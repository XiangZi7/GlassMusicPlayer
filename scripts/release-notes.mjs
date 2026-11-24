import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetName, releaseTargets } from './release-targets.mjs'
import { parseReleaseTag } from './release-version.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

const categories = [
  ['features', '✨ 新增功能'],
  ['fixes', '🐛 问题修复'],
  ['improvements', '⚡ 优化改进'],
  ['docs', '📝 文档更新'],
  ['maintenance', '🔧 构建与维护'],
  ['other', '📦 其他更新'],
]
const categoryByType = {
  feat: 'features',
  fix: 'fixes',
  revert: 'fixes',
  perf: 'improvements',
  refactor: 'improvements',
  style: 'improvements',
  docs: 'docs',
  build: 'maintenance',
  ci: 'maintenance',
  test: 'maintenance',
  chore: 'maintenance',
}

// 在生成发版日志时读取完整 Git 历史，命令失败则中止发布，避免生成不完整说明。
function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd()
}

// 选择当前历史中最近的已发布版本，跳过草稿、失败标签以及正式版之前的预发布版。
function previousReleaseTag(root, tag, releases) {
  const current = parseReleaseTag(tag)
  const published = new Set(
    releases
      .filter(release => {
        if (release.draft || release.tag_name === tag) return false
        try {
          const candidate = parseReleaseTag(release.tag_name)
          return (
            current.prerelease || (!release.prerelease && !candidate.prerelease)
          )
        } catch {
          return false
        }
      })
      .map(release => release.tag_name)
  )
  return git(
    root,
    'tag',
    '--list',
    'v*',
    '--merged',
    `refs/tags/${tag}`,
    '--sort=-version:refname'
  )
    .split(/\r?\n/)
    .find(candidate => published.has(candidate))
}

// 将提交标题作为普通文本输出，防止 Markdown 标记破坏更新条目和链接。
function escapeMarkdown(value) {
  return value.replace(/([\\`*_[\]<>])/g, '\\$1')
}

// 为下载表生成方形徽章，复用打包命名规则直达当前版本的实际附件。
function downloadBadge(url, tag, targetId, extension) {
  const packageType = releaseTargets[targetId].find(asset => asset.extension === extension)
  const badge = `https://raw.githubusercontent.com/${url.slice('https://github.com/'.length)}/${tag}/docs/images/badges/${packageType.badge}.svg`
  const download = `${url}/releases/download/${tag}/${assetName(tag.slice(1), targetId, packageType)}`
  return `[![${packageType.label}](${badge})](${download})`
}

// 根据实际提交生成中文更新说明，保留正文细节与链接，供新建及重试发布草稿使用。
export function generateReleaseNotes(root, { tag, repository, releases }) {
  parseReleaseTag(tag)
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new Error('无效的 GitHub 仓库名称')
  if (git(root, 'rev-parse', '--is-shallow-repository') === 'true')
    throw new Error(
      '生成更新日志需要完整 Git 历史，请设置 checkout 的 fetch-depth: 0'
    )

  const previous = previousReleaseTag(root, tag, releases)
  const range = previous
    ? `refs/tags/${previous}..refs/tags/${tag}`
    : `refs/tags/${tag}`
  const fields = git(
    root,
    'log',
    '--no-merges',
    '--reverse',
    '-z',
    '--format=%H%x00%s%x00%b',
    range,
    '--'
  ).split('\0')
  const groups = new Map(categories.map(([key]) => [key, []]))
  const url = `https://github.com/${repository}`
  let count = 0

  for (let index = 0; index + 2 < fields.length; index += 3) {
    const [sha, subject, body] = fields.slice(index, index + 3)
    // 兼容仓库现有的 emoji + Conventional Commit 标题和普通提交标题。
    const match =
      /^[^\p{L}\p{N}]*(feat|fix|perf|refactor|docs|style|test|build|ci|chore|revert)(?:\(([^)]+)\))?(!)?:\s*(.+)$/iu.exec(
        subject
      )
    const [, type, scope, breaking, description] = match ?? []
    if (
      type?.toLowerCase() === 'chore' &&
      scope === 'release' &&
      /^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(description)
    )
      continue

    const title = match ? `${scope ? `${scope}：` : ''}${description}` : subject
    const entry = [
      `- ${breaking ? '**破坏性变更：** ' : ''}${escapeMarkdown(title)} ([\`${sha.slice(0, 7)}\`](${url}/commit/${sha}))`,
    ]
    if (body.trim()) {
      entry.push(
        '',
        ...body
          .trim()
          .split(/\r?\n/)
          .map(line => (line ? `  ${line}` : ''))
      )
    }
    groups
      .get(categoryByType[type?.toLowerCase()] ?? 'other')
      .push(entry.join('\n'))
    count++
  }

  const lines = ['## 更新内容', '']
  if (count) {
    lines.push(
      previous
        ? `自 ${previous} 以来，共 ${count} 项提交更新。`
        : `首次发布，共 ${count} 项提交更新。`,
      ''
    )
    for (const [key, title] of categories) {
      const entries = groups.get(key)
      if (entries.length)
        lines.push(`### ${title}`, '', entries.join('\n\n'), '')
    }
  } else {
    lines.push('本版本没有新的功能或修复提交，仅包含版本发布调整。', '')
  }
  lines.push(
    '## 下载与安装',
    '',
    '| OS | Download |',
    '| --- | --- |',
    `| **Windows** | ${downloadBadge(url, tag, 'windows_x64', 'setup.exe')} ${downloadBadge(url, tag, 'windows_x64', 'portable.zip')} |`,
    `| **macOS** | ${downloadBadge(url, tag, 'macos_arm64', 'dmg')} ${downloadBadge(url, tag, 'macos_x64', 'dmg')} |`,
    `| **Linux** | ${downloadBadge(url, tag, 'linux_x64', 'AppImage')} ${downloadBadge(url, tag, 'linux_x64', 'deb')} |`,
    '',
    'Windows ZIP 需要 WebView2 Runtime；macOS 请先将应用移入「应用程序」。Linux AppImage 需添加执行权限；DEB 请用包管理器安装。SHA256SUMS.txt 校验附件，version.json 记录版本、源码提交与目标。',
    'macOS 默认临时签名，未配置 Apple 开发者签名与公证时，首次打开可能需在「隐私与安全性」允许。',

    '',
    previous
      ? `**Full Changelog**: [${previous}...${tag}](${url}/compare/${previous}...${tag})`
      : `**完整提交记录**: [${tag}](${url}/commits/${tag})`,
    ''
  )
  return lines.join('\n')
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [tag, repository, output, releasesFile, ...extra] =
      process.argv.slice(2)
    if (!output || !releasesFile || extra.length)
      throw new Error(
        '用法：node scripts/release-notes.mjs <tag> <owner/repo> <输出.md> <已发布版本.json>'
      )
    const releases = JSON.parse(readFileSync(releasesFile, 'utf8'))
    writeFileSync(
      output,
      generateReleaseNotes(projectRoot, { tag, repository, releases })
    )
    console.log(`更新日志已生成：${output}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
