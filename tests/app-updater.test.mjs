import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { createPinia, disposePinia } from 'pinia'

const require = createRequire(import.meta.url)
const defaults = { autoUpdate: true, updateSource: 'auto', updateDownloadProxy: '' }

// 加载真实的 TypeScript 模块，以可控的 Tauri 接口替代网络、安装器与原生窗口。
function load(file, dependencies, globals = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const exports = {}
  vm.runInNewContext(outputText, {
    require: name => dependencies[name] ?? require(name), exports,
    URL, Date, setTimeout, clearTimeout, ...globals,
  }, { filename: file })
  return exports
}

// 模拟主窗和独立设置窗各自的 Pinia、原生事件路由与下载资源。
function fixture(t, checkAppUpdate, settings = defaults) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let label = 'main'
  const listeners = new Map()
  const core = { isTauri: () => true, invoke: async () => true }
  const events = {
    async listen(name, fn) {
      const key = label + ':' + name
      listeners.set(key, fn)
      return () => listeners.delete(key)
    },
    async emitTo(to, name, payload) { listeners.get(to + ':' + name)?.({ payload }) },
  }
  const { useAppUpdaterStore } = load('src/stores/app-updater.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '@tauri-apps/api/core': core, '@tauri-apps/api/event': events,
    '@tauri-apps/api/window': { getCurrentWindow: () => ({ label }) },
    '@tauri-apps/plugin-opener': {}, '@/services/notification': {},
    '@/services/app-updater': { checkAppUpdate },
    '@/stores/player': { usePlayerStore: () => ({ state: { settings: { ...settings } } }) },
  }, { window: new EventTarget(), setTimeout, clearTimeout })
  // 每个 WebView 持有独立 store，设置窗只能转发命令并重放主窗快照。
  async function mount(name) {
    label = name
    const pinia = createPinia()
    t.after(() => disposePinia(pinia))
    const instance = useAppUpdaterStore(pinia)
    await instance.start()
    return instance
  }
  return { mount, timers: t.mock.timers }
}

// 等待一次跨窗口消息和所有异步微任务。
async function flush() { await new Promise(resolve => setImmediate(resolve)) }

test('both windows share discovery, verified bytes, defer, retry install and concurrent commands', async t => {
  let checks = 0, downloads = 0, installs = 0, verify
  const update = {
    version: '1.0.0', manual: false,
    async download(report) {
      downloads++
      report({ event: 'Started', data: { contentLength: 100 } })
      report({ event: 'Progress', data: { chunkLength: 100 } })
      report({ event: 'Finished' })
      await new Promise(resolve => { verify = resolve })
    },
    async install() {
      if (++installs === 1) throw new Error('安装器被占用')
    },
    async close() {},
  }
  const app = fixture(t, async () => { checks++; return update })
  const main = await app.mount('main')
  app.timers.tick(15_000)
  await flush()
  assert.equal(main.state.phase, 'available')
  assert.equal(downloads, 0)
  const settings = await app.mount('settings')
  assert.equal(settings.state.version, '1.0.0')
  await Promise.all([settings.command('download'), settings.command('download')])
  assert.equal(checks, 1)
  assert.equal(downloads, 1)
  assert.equal(settings.state.phase, 'downloading')
  await settings.command('install')
  assert.equal(installs, 0)
  verify()
  await flush()
  assert.equal(settings.state.phase, 'ready')
  assert.equal(settings.state.downloaded, 100)
  await settings.command('defer')
  app.timers.tick(24 * 60 * 60 * 1000)
  assert.equal(main.state.deferred, true)
  assert.equal(installs, 0)
  await settings.command('install')
  await flush()
  assert.equal(main.state.errorStage, 'install')
  await settings.command('install')
  await flush()
  assert.equal(installs, 2)
  assert.equal(settings.state.phase, 'installing')
})

test('source changes discard stale checks, preserve manual intent, and allow discovery without signing', async t => {
  let resolveOld, discarded = 0
  const calls = []
  const app = fixture(t, async prefs => {
    calls.push(prefs.updateSource)
    if (prefs.updateSource === 'auto') return new Promise(resolve => { resolveOld = resolve })
    return { version: '2.0.0', manual: true, close: async () => {} }
  }, { ...defaults, autoUpdate: false })
  const main = await app.mount('main')
  app.timers.tick(15_000)
  assert.deepEqual(calls, [])
  const checking = main.command('check')
  await flush()
  main.applyPreferences({ ...defaults, autoUpdate: false, updateSource: 'github' })
  resolveOld({ version: '1.0.0', close: async () => { discarded++ } })
  await checking
  await flush()
  assert.deepEqual(calls, ['auto', 'github'])
  assert.equal(discarded, 1)
  assert.equal(main.state.phase, 'available')
  assert.equal(main.state.reason, 'manual')
  assert.equal(main.state.version, '2.0.0')
})

test('check and verification failures are retriable, automatic retries only check metadata', async t => {
  let checks = 0, downloads = 0, rejected = 0
  const app = fixture(t, async () => {
    if (++checks === 1) throw new Error('offline')
    return {
      version: '1.0.0', manual: false,
      download: async () => { if (++downloads === 1) throw new Error('签名无效') },
      close: async () => { rejected++ },
    }
  })
  const main = await app.mount('main')
  await main.command('check')
  assert.equal(main.state.errorStage, 'check')
  app.timers.tick(60_000)
  await flush()
  assert.equal(main.state.phase, 'available')
  assert.equal(downloads, 0)
  await main.command('download')
  assert.equal(main.state.errorStage, 'download')
  assert.equal(rejected, 1)
  await main.command('download')
  assert.equal(checks, 3)
  assert.equal(main.state.phase, 'ready')
})

test('release comparison and fallback select a verified package of the same version', async () => {
  const service = load('src/services/app-updater.ts', {
    '@tauri-apps/api/core': {}, '@tauri-apps/plugin-updater': {},
    '@/services/update-preferences': load('src/services/update-preferences.ts', {}),
  })
  assert.equal(service.newerStableTag('v0.10.0', '0.9.99'), '0.10.0')
  assert.equal(service.newerStableTag('v0.10.0', '0.10.0-rc.1'), '0.10.0')
  assert.equal(service.newerStableTag('v0.10.0', '0.10.0'), null)
  assert.equal(service.newerStableTag('v0.10.0', '0.11.0-beta.1'), null)
  for (const invalid of ['v1.1.0\n', 'v1.1.0-rc.1', 'v999999.1.0', null])
    assert.throws(() => service.newerStableTag(invalid, '0.1.3'))
  const routes = [], closed = [], downloaded = []
  const update = await service.checkAppUpdate(defaults, async prefix => {
    routes.push(prefix)
    return {
      version: routes.length === 2 ? '3.0.0' : '1.0.0',
      package: {
        download: async () => { downloaded.push(prefix); if (prefix) throw new Error('bad signature') },
        close: async () => { closed.push(prefix) },
      },
    }
  })
  await update.download(() => {})
  assert.deepEqual(routes, ['https://gh-proxy.com/', 'https://ghfast.top/', ''])
  assert.deepEqual(downloaded, [routes[0], ''])
  await update.close()
  assert.deepEqual(closed, routes)
})

test('a failed relaunch retries only the restart after the installer has consumed its verified bytes', async () => {
  let installs = 0, restarts = 0
  const service = load('src/services/app-updater.ts', {
    '@tauri-apps/api/core': {
      invoke: async name => {
        assert.equal(name, 'updater_restart')
        if (++restarts === 1) throw new Error('restart temporarily unavailable')
      },
    },
    '@tauri-apps/plugin-updater': {}, '@/services/update-preferences': {},
  })
  const update = await service.checkAppUpdate(defaults, async () => ({
    version: '1.0.0',
    package: { install: async () => { assert.equal(++installs, 1) } },
  }))
  await assert.rejects(update.install(), /restart temporarily unavailable/)
  await update.install()
  assert.equal(installs, 1)
  assert.equal(restarts, 2)
})

test('update preferences migrate old saves, round-trip applied settings, and reject invalid proxies', () => {
  const values = new Map()
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const { preferencesKey, readPlayerPreferences, writePlayerPreferences } = load(
    'src/services/player/preferences.ts',
    {
      '@/constants/music': { defaultCover: '/cover.svg' },
      '@/services/update-preferences': load('src/services/update-preferences.ts', {}),
    },
    { localStorage },
  )
  localStorage.setItem(preferencesKey, JSON.stringify({ version: 1, settings: { motion: false } }))
  const old = readPlayerPreferences({ ...defaults, motion: true })
  assert.deepEqual({ ...old.settings }, { ...defaults, motion: false })
  const custom = { autoUpdate: false, updateSource: 'custom', updateDownloadProxy: 'https://mirror.example/base' }
  Object.assign(old.settings, custom)
  assert.equal(writePlayerPreferences(old), true)
  assert.deepEqual({ ...readPlayerPreferences(defaults).settings }, custom)
  for (const invalid of ['http://mirror.example', 'https://user:pass@mirror.example', 'https://mirror.example/?token=sample', '#broken']) {
    localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1, settings: { ...custom, updateDownloadProxy: invalid },
    }))
    assert.deepEqual({ ...readPlayerPreferences(defaults).settings }, { ...defaults, autoUpdate: false })
  }
})
