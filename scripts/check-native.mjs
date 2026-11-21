import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const manifestPath = path.join(root, 'src-tauri', 'Cargo.toml')
const cargo = process.env.CARGO || 'cargo'

function run(command, args, stdio = 'inherit') {
  const result = spawnSync(command, args, { cwd: root, stdio })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `${path.basename(command)} failed (${result.status ?? result.signal})`
    )
}

run(cargo, ['fmt', '--manifest-path', manifestPath, '--', '--check'])
run(cargo, ['check', '--locked', '--manifest-path', manifestPath])

if (process.platform !== 'win32') {
  run(cargo, [
    'test',
    '--locked',
    '--manifest-path',
    manifestPath,
    '--lib',
    'desktop::',
  ])
} else {
  // Windows 的 Tauri 单元测试没有应用 EXE 的 Common-Controls v6 声明。
  // 仅为 cargo 生成的测试产物附加相同声明，不修改源码、主程序或系统库。
  const sdk = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Windows Kits',
    '10',
    'bin'
  )
  const versions = fs
    .readdirSync(sdk)
    .filter(name => /^\d+(?:\.\d+){3}$/.test(name))
    .sort((a, b) => {
      const aa = a.split('.').map(Number),
        bb = b.split('.').map(Number)
      for (let i = 0; i < aa.length; i++)
        if (aa[i] !== bb[i]) return bb[i] - aa[i]
      return 0
    })
  const arch =
    process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? 'x86' : 'x64'
  const mt = versions
    .map(version => path.join(sdk, version, arch, 'mt.exe'))
    .find(file => fs.existsSync(file))
  assert(
    mt,
    'Windows SDK mt.exe is required for the Tauri test executable manifest. No SDK is installed automatically.'
  )
  const scratchRoot = path.join(root, '.tmp')
  fs.mkdirSync(scratchRoot, { recursive: true })
  const scratch = fs.mkdtempSync(path.join(scratchRoot, 'native-check-'))
  const output = path.join(scratch, 'cargo-artifacts.jsonl')
  const fd = fs.openSync(output, 'wx')
  try {
    // 用文件而不是子进程输出管道，也可在受限的 Windows 环境使用。
    run(
      cargo,
      [
        'test',
        '--locked',
        '--manifest-path',
        manifestPath,
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
  const artifacts = records.filter(
    record =>
      record.reason === 'compiler-artifact' &&
      record.profile?.test &&
      record.target?.name === 'miraimusic_lib' &&
      typeof record.executable === 'string'
  )
  assert.equal(
    artifacts.length,
    1,
    'Expected exactly one generated library test executable.'
  )
  const executable = path.resolve(artifacts[0].executable)
  const relative = path.relative(root, executable)
  assert(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    'Refusing to modify an executable outside this project.'
  )
  assert(
    /^miraimusic_lib-[a-f\d]+\.exe$/i.test(path.basename(executable)) &&
      fs.statSync(executable).isFile(),
    'Refusing to modify an unexpected executable.'
  )
  const controlsManifest = path.join(scratch, 'common-controls.manifest')
  fs.writeFileSync(
    controlsManifest,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency><dependentAssembly>
    <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
  </dependentAssembly></dependency>
</assembly>
`,
    { flag: 'wx' }
  )
  console.log(
    `Apply the existing Tauri Common-Controls v6 declaration to ${relative}.`
  )
  run(mt, [
    '-manifest',
    controlsManifest,
    `-outputresource:${executable};#1`,
    '-nologo',
  ])
  run(executable, ['desktop::'])
}
console.log(
  'Native checks passed: Rust format, locked compile, and actual desktop unit tests. No tray/UI interaction is claimed by this script.'
)
