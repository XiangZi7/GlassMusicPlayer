import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '../..')
const cargo = process.env.CARGO || 'cargo'
const manifest = path.join(root, 'src-tauri/Cargo.toml')

// 原生回归只检查本任务的源码，子进程使用继承/文件输出，不使用命名管道。
function run(command, args, stdio = 'inherit') {
  const result = spawnSync(command, args, { cwd: root, stdio })
  if (result.error) throw result.error
  assert.equal(
    result.status,
    0,
    `${path.basename(command)} failed (${result.status ?? result.signal})`
  )
}
run('rustfmt', [
  '--edition',
  '2024',
  '--check',
  'src-tauri/src/storage.rs',
  'src-tauri/src/app.rs',
])
run(cargo, ['check', '--locked', '--manifest-path', manifest])

if (process.platform === 'win32') {
  const sdk = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Windows Kits',
    '10',
    'bin'
  )
  const versions = fs
    .readdirSync(sdk)
    .filter(name => /^\d+(?:\.\d+){3}$/.test(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  const arch =
    process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? 'x86' : 'x64'
  const mt = versions
    .map(version => path.join(sdk, version, arch, 'mt.exe'))
    .find(file => fs.existsSync(file))
  assert(
    mt,
    'Existing Windows SDK mt.exe is required; no SDK is installed automatically.'
  )
  const scratch = path.join(
    root,
    'src-tauri',
    'target',
    `storage-check-${Date.now()}-${process.pid}`
  )
  fs.mkdirSync(scratch, { recursive: true })
  const output = path.join(scratch, 'artifacts.jsonl')
  const fd = fs.openSync(output, 'wx')
  try {
    run(
      cargo,
      [
        'test',
        '--locked',
        '--manifest-path',
        manifest,
        '--lib',
        '--no-run',
        '--message-format=json',
      ],
      ['ignore', fd, 'inherit']
    )
  } finally {
    fs.closeSync(fd)
  }
  const records = fs
    .readFileSync(output, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line))
  const tests = records.filter(
    record =>
      record.reason === 'compiler-artifact' &&
      record.profile?.test &&
      record.target?.name === 'miraimusic_lib' &&
      typeof record.executable === 'string'
  )
  assert.equal(tests.length, 1)
  const executable = fs.realpathSync(tests[0].executable)
  const target = fs.realpathSync(path.join(root, 'src-tauri', 'target'))
  const relative = path.relative(target, executable)
  assert(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    'Only the generated native target artifact may be modified.'
  )
  assert(/^miraimusic_lib-[a-f\d]+\.exe$/i.test(path.basename(executable)))
  assert(
    fs.lstatSync(executable).isFile() &&
      !fs.lstatSync(executable).isSymbolicLink()
  )
  const controls = path.join(scratch, 'common-controls.manifest')
  fs.writeFileSync(
    controls,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency><dependentAssembly>
    <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
  </dependentAssembly></dependency>
</assembly>
`,
    { flag: 'wx' }
  )
  run(mt, [
    '-manifest',
    controls,
    `-outputresource:${executable};#1`,
    '-nologo',
  ])
  run(executable, ['storage::', '--nocapture'])
  console.log(
    `Storage test artifacts retained without deleting files: ${scratch}`
  )
} else {
  run(cargo, [
    'test',
    '--locked',
    '--manifest-path',
    manifest,
    '--lib',
    'storage::',
  ])
}
console.log(
  'Storage checks passed: locked compile, scoped format and actual pure safety unit tests. No directory picker, live account download or destructive cache clearing is claimed.'
)
