import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const vue = require('vue')
const sfc = require('vue/compiler-sfc')
const base = Date.parse('2026-11-20T12:00:00Z')
const compile = source =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
function load(relative, dependencies = {}, globals = {}) {
  const module = { exports: {} }
  const source = fs
    .readFileSync(path.join(root, relative), 'utf8')
    .replaceAll('import.meta.hot', '__hot')
  vm.runInNewContext(
    compile(source),
    {
      exports: module.exports,
      module,
      require(name) {
        assert(name in dependencies, `Unexpected import: ${name}`)
        return dependencies[name]
      },
      AbortController,
      Date,
      URL,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      __hot: undefined,
      ...globals,
    },
    { filename: relative }
  )
  return module.exports
}
const service = load('src/services/local-weather.ts')
const dependencies = { vue, '@tauri-apps/api/core': { isTauri: () => false }, '@/services/local-weather': service }
const weatherModule = load('src/composables/useLocalWeather.ts', dependencies)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const flush = async () => {
  for (let index = 0; index < 16; index++) await Promise.resolve()
}
const response = payload => ({ ok: true, json: async () => payload })
function payload(now = base, changes = {}) {
  return {
    current_units: { time: 'unixtime', temperature_2m: '°C' },
    current: {
      time: Math.floor(now / 1_000),
      temperature_2m: 17.6,
      weather_code: 2,
      is_day: 1,
      ...changes,
    },
  }
}
function permission(state = 'granted') {
  const listeners = new Set()
  return {
    state,
    listeners,
    addEventListener(type, listener) {
      assert.equal(type, 'change')
      listeners.add(listener)
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'change')
      listeners.delete(listener)
    },
    change(next) {
      this.state = next
      for (const listener of [...listeners]) listener()
    },
  }
}
function harness(overrides = {}, initial) {
  let clock = base
  let timerId = 0
  const timers = new Map(),
    positions = [],
    requests = [],
    permissionQueries = [],
    values = []
  const permissionStatus = overrides.permissionStatus ?? permission()
  const setTimer = (run, delay) => {
    const id = ++timerId
    timers.set(id, { run, at: clock + delay })
    return id
  }
  const clearTimer = id => timers.delete(id)
  const native = {
    getCurrentPosition(resolve, reject, options) {
      positions.push({ resolve, reject, options })
      if (overrides.locate) overrides.locate(resolve, reject, options)
      else
        queueMicrotask(() =>
          resolve({
            coords: { latitude: 35.123456, longitude: 112.654321 },
            timestamp: clock,
          })
        )
    },
  }
  const fetch = async (url, options) => {
    requests.push({ url, options })
    return overrides.fetch
      ? overrides.fetch(url, options, clock)
      : response(payload(clock))
  }
  const deps = {
    nearbyCity: overrides.nearbyCity ?? (async () => undefined),
    resetPermission: overrides.resetPermission ?? null,
    geolocation: overrides.unsupported ? null : native,
    permissions: overrides.noPermissions
      ? null
      : {
          query(descriptor) {
            permissionQueries.push(descriptor)
            return overrides.queryPermission
              ? overrides.queryPermission(descriptor)
              : Promise.resolve(permissionStatus)
          },
        },
    fetch: overrides.noFetch ? null : fetch,
    now: () => clock,
    setTimer,
    clearTimer,
  }
  const client = weatherModule.createLocalWeatherClient(deps, initial)
  const subscribe = () => client.subscribe(value => values.push(value))
  async function tick(ms) {
    await flush()
    clock += ms
    for (let cycle = 0; cycle < 100; cycle++) {
      const due = [...timers].filter(([, task]) => task.at <= clock)
      if (due.length === 0) break
      for (const [id, task] of due) {
        timers.delete(id)
        task.run()
      }
      await flush()
      assert(cycle < 99, 'Timers must not create a busy loop')
    }
    await flush()
  }
  return {
    client,
    subscribe,
    timers,
    positions,
    requests,
    values,
    permissionQueries,
    permissionStatus,
    tick,
    deps,
    now: () => clock,
  }
}
let count = 0
async function check(name, test) {
  await test()
  count++
  console.log(`PASS ${name}`)
}
await check('离线索引匹配城市中心，海上保留空地名', async () => {
  const table = fs.readFileSync(path.join(root, 'src/assets/weather-cities.json'), 'utf8')
  let loads = 0
  const { findNearbyCity } = load('src/services/nearby-city.ts', {
    '@/assets/weather-cities.json?url': '/assets/weather-cities.json',
  }, { fetch: async url => {
    assert.equal(url, '/assets/weather-cities.json')
    loads++
    return response(JSON.parse(table))
  } })
  assert.equal(await findNearbyCity(30.29365, 120.16142), '杭州')
  assert.equal(await findNearbyCity(51.509, -0.126), 'London')
  assert.equal(await findNearbyCity(0, -145), undefined)
  assert.equal(await findNearbyCity(NaN, 0), undefined)
  assert.equal(loads, 1)
})

await check('地名延迟时先显示天气，主界面与全屏共享且不进入快照', async () => {
  const city = deferred()
  let lookups = 0
  const h = harness({ nearbyCity: () => { lookups++; return city.promise } })
  const stop = h.subscribe()
  const stopSecond = h.subscribe()
  await flush()
  assert.equal(h.values.at(-1).label, '多云')
  assert.equal(h.values.at(-1).nearbyCity, undefined)
  city.resolve('测试城市')
  await flush()
  assert.equal(h.values.at(-1).nearbyCity, '测试城市')
  assert.equal(h.positions.length, 1)
  assert.equal(lookups, 1)
  assert(!JSON.stringify(h.client.snapshot()).includes('测试城市'))
  stopSecond()
  stop()
})

await check('权限撤销后迟到的地名不能恢复显示', async () => {
  const city = deferred()
  const h = harness({ nearbyCity: () => city.promise })
  const stop = h.subscribe()
  await flush()
  h.permissionStatus.change('denied')
  city.resolve('旧地名')
  await flush()
  assert.equal(h.values.at(-1), null)
  stop()
})

await check(
  'weather TypeScript modules pass the project strict compiler settings',
  () => {
    const configPath = path.join(root, 'tsconfig.json')
    const config = ts.readConfigFile(configPath, ts.sys.readFile)
    assert.equal(config.error, undefined)
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
    const program = ts.createProgram(
      [
        path.join(root, 'src/services/local-weather.ts'),
        path.join(root, 'src/composables/useLocalWeather.ts'),
        path.join(root, 'src/vite-env.d.ts'),
      ],
      parsed.options
    )
    const diagnostics = ts.getPreEmitDiagnostics(program)
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: name => name,
        getCurrentDirectory: () => root,
        getNewLine: () => '\n',
      })
    )
  }
)
await check(
  'all supported WMO codes map to real labels and weather families',
  () => {
    const codes = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75,
      77, 80, 81, 82, 85, 86, 95, 96, 99,
    ]
    for (const code of codes) {
      assert(service.describeWeather(code, true)?.label)
      assert(service.describeWeather(code, false)?.icon)
    }
    assert.equal(service.describeWeather(0, true).icon, 'sun')
    assert.equal(service.describeWeather(0, false).icon, 'moon')
    assert.equal(service.describeWeather(2, true).icon, 'partly-day')
    assert.equal(service.describeWeather(2, false).icon, 'partly-night')
    assert.equal(service.describeWeather(45, false).icon, 'fog')
    assert.equal(service.describeWeather(65, true).icon, 'rain')
    assert.equal(service.describeWeather(75, true).icon, 'snow')
    assert.equal(service.describeWeather(95, false).icon, 'thunder')
    for (const code of [-1, 4, 49, 100, 2.5, NaN])
      assert.equal(service.describeWeather(code, true), null)
  }
)
await check(
  'valid response produces narrow Celsius data, never a city or position',
  () => {
    const result = service.parseCurrentWeather(
      { ...payload(), latitude: 35, longitude: 112 },
      base
    )
    assert.equal(result.temperatureCelsius, 17.6)
    assert.equal(result.label, '多云')
    assert.equal(result.observedAt, base)
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        'icon',
        'isDay',
        'label',
        'observedAt',
        'temperatureCelsius',
        'weatherCode',
      ].sort()
    )
    assert.equal(service.formatWeatherTemperature(-0.2), '0°')
  }
)
const invalidFields = [
  ['null temperature', { temperature_2m: null }],
  ['string temperature', { temperature_2m: '17' }],
  ['non-finite temperature', { temperature_2m: NaN }],
  ['infinite temperature', { temperature_2m: Infinity }],
  ['impossible temperature', { temperature_2m: 150 }],
  ['unknown weather code', { weather_code: 4 }],
  ['non-integer weather code', { weather_code: 2.2 }],
  ['string weather code', { weather_code: '2' }],
  ['missing daytime', { is_day: undefined }],
  ['invalid daytime', { is_day: 2 }],
  ['boolean daytime', { is_day: true }],
  ['missing observation time', { time: undefined }],
  ['string observation time', { time: '2026-11-20T20:00' }],
  ['old observation', { time: (base - service.WEATHER_MAX_AGE_MS) / 1_000 }],
  ['future observation', { time: (base + 6 * 60_000) / 1_000 }],
]
for (const [name, changes] of invalidFields) {
  await check(`parser hides ${name}`, () =>
    assert.equal(
      service.parseCurrentWeather(payload(base, changes), base),
      null
    )
  )
}
await check(
  'missing, empty or wrong-unit data never renders fabricated defaults',
  () => {
    for (const data of [
      undefined,
      null,
      {},
      [],
      { current: {} },
      { ...payload(), current: [] },
      {
        ...payload(),
        current_units: { time: 'unixtime', temperature_2m: '°F' },
      },
    ]) {
      assert.equal(service.parseCurrentWeather(data, base), null)
    }
  }
)
await check(
  'one-shot coarse geolocation and exact public endpoint succeed',
  async () => {
    const h = harness(),
      stop = h.subscribe()
    assert.equal(h.values.at(-1), null, 'No loading placeholder')
    await flush()
    assert.equal(h.positions.length, 1)
    assert.equal(h.positions[0].options.enableHighAccuracy, false)
    assert.equal(h.positions[0].options.timeout, 8_000)
    assert.equal(h.positions[0].options.maximumAge, 0)
    assert.equal(h.permissionQueries.length, 1)
    assert.equal(h.permissionQueries[0].name, 'geolocation')
    assert.equal(h.requests.length, 1)
    const url = new URL(h.requests[0].url)
    assert.equal(
      url.origin + url.pathname,
      'https://api.open-meteo.com/v1/forecast'
    )
    assert.equal(url.searchParams.get('latitude'), '35.12')
    assert.equal(url.searchParams.get('longitude'), '112.65')
    assert.equal(
      url.searchParams.get('current'),
      'temperature_2m,weather_code,is_day'
    )
    assert.equal(url.searchParams.get('timezone'), 'auto')
    assert.equal(url.searchParams.get('timeformat'), 'unixtime')
    assert.equal(h.requests[0].options.credentials, 'omit')
    assert.equal(h.requests[0].options.cache, 'no-store')
    assert.equal(h.values.at(-1).label, '多云')
    assert(!JSON.stringify(h.client.snapshot()).includes('latitude'))
    stop()
    assert.equal(h.timers.size, 0)
  }
)
for (const [name, overrides] of [
  ['location denied', { locate: (_yes, no) => no({ code: 1 }) }],
  ['location unavailable', { locate: (_yes, no) => no({ code: 2 }) }],
  ['location unsupported', { unsupported: true }],
  ['fetch unsupported', { noFetch: true }],
  [
    'native location throws',
    {
      locate: () => {
        throw new Error('Unavailable')
      },
    },
  ],
]) {
  await check(
    `${name} stays hidden without an alternative IP location`,
    async () => {
      const h = harness(overrides),
        stop = h.subscribe()
      await flush()
      assert(h.values.every(value => value === null))
      assert.equal(h.requests.length, 0)
      stop()
      assert.equal(h.timers.size, 0)
    }
  )
}
await check(
  'geolocation deadline is eight seconds and late location cannot request weather',
  async () => {
    const h = harness({ locate() {} }),
      stop = h.subscribe()
    await h.tick(8_000)
    assert(h.values.every(value => value === null))
    h.positions[0].resolve({
      coords: { latitude: 35, longitude: 112 },
      timestamp: h.now(),
    })
    await flush()
    assert.equal(h.requests.length, 0)
    stop()
    assert.equal(h.timers.size, 0)
  }
)
await check(
  'invalid or stale location is discarded before the network',
  async () => {
    for (const position of [
      { coords: { latitude: NaN, longitude: 112 }, timestamp: base },
      { coords: { latitude: 91, longitude: 112 }, timestamp: base },
      { coords: { latitude: 35, longitude: 181 }, timestamp: base },
      {
        coords: { latitude: 35, longitude: 112 },
        timestamp: base - 16 * 60_000,
      },
    ]) {
      const h = harness({ locate: yes => yes(position) }),
        stop = h.subscribe()
      await flush()
      assert.equal(h.requests.length, 0)
      assert(h.values.every(value => value === null))
      stop()
    }
  }
)
for (const [name, fetch] of [
  [
    'network rejection',
    async () => {
      throw new Error('Network unavailable')
    },
  ],
  ['HTTP failure', async () => ({ ok: false, json: async () => payload() })],
  [
    'invalid JSON',
    async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Invalid JSON')
      },
    }),
  ],
  ['empty data', async () => response({})],
  [
    'old data',
    async () => response(payload(base, { time: (base - 60 * 60_000) / 1_000 })),
  ],
]) {
  await check(`${name} stays hidden`, async () => {
    const h = harness({ fetch }),
      stop = h.subscribe()
    await flush()
    assert(h.values.every(value => value === null))
    stop()
    assert.equal(h.timers.size, 0)
  })
}
await check(
  'network and JSON share an eight-second abort deadline',
  async () => {
    for (const jsonPending of [false, true]) {
      const pending = deferred()
      const h = harness({
        fetch: () =>
          jsonPending
            ? { ok: true, json: () => pending.promise }
            : pending.promise,
      })
      const stop = h.subscribe()
      await flush()
      await h.tick(8_000)
      assert(h.requests[0].options.signal.aborted)
      assert(h.values.every(value => value === null))
      pending.resolve(
        jsonPending ? payload(h.now()) : response(payload(h.now()))
      )
      await flush()
      assert(h.values.every(value => value === null))
      stop()
      assert.equal(h.timers.size, 0)
    }
  }
)
await check(
  'unsubscribing during location ignores its late callback and clears every timer',
  async () => {
    const h = harness({ locate() {} }),
      stop = h.subscribe()
    await flush()
    stop()
    assert.equal(h.timers.size, 0)
    h.positions[0].resolve({
      coords: { latitude: 35, longitude: 112 },
      timestamp: base,
    })
    await flush()
    assert.equal(h.requests.length, 0)
  }
)
await check(
  'disable or unload aborts pending network and ignores its late result',
  async () => {
    const pending = deferred(),
      h = harness({ fetch: () => pending.promise })
    const stop = h.subscribe()
    await flush()
    stop()
    assert(h.requests[0].options.signal.aborted)
    assert.equal(h.timers.size, 0)
    pending.resolve(response(payload()))
    await flush()
    assert(h.values.every(value => value === null))
  }
)
await check(
  'an older cancelled request cannot overwrite a newer enabled generation',
  async () => {
    const old = deferred(),
      fresh = deferred()
    let calls = 0
    const h = harness({
      fetch: () => (++calls === 1 ? old.promise : fresh.promise),
    })
    const stopOld = h.subscribe()
    await flush()
    stopOld()
    await h.tick(15 * 60_000)
    const stopFresh = h.subscribe()
    await flush()
    fresh.resolve(
      response(
        payload(h.now(), { temperature_2m: 7, weather_code: 71, is_day: 0 })
      )
    )
    await flush()
    old.resolve(
      response(payload(h.now(), { temperature_2m: 40, weather_code: 0 }))
    )
    await flush()
    assert.equal(h.values.at(-1).temperatureCelsius, 7)
    assert.equal(h.values.at(-1).icon, 'snow')
    assert.equal(h.values.at(-1).isDay, false)
    stopFresh()
  }
)
await check(
  'concurrent subscriptions and rapid remount share cache and fifteen-minute throttle',
  async () => {
    const h = harness(),
      first = h.subscribe(),
      second = h.subscribe()
    await flush()
    assert.equal(h.positions.length, 1)
    first()
    assert.equal(
      h.timers.size,
      1,
      'Another enabled consumer still needs one refresh timer'
    )
    second()
    const third = h.subscribe()
    await flush()
    assert.equal(h.positions.length, 1)
    assert.equal(h.values.at(-1).label, '多云')
    await h.tick(15 * 60_000 - 1)
    assert.equal(h.positions.length, 1)
    await h.tick(1)
    assert.equal(h.positions.length, 2)
    third()
    assert.equal(h.timers.size, 0)
  }
)
await check(
  'stale cached weather disappears before a throttled refresh',
  async () => {
    const h = harness(
      {},
      {
        lastAttempt: base,
        weather: service.parseCurrentWeather(payload(base - 20 * 60_000), base),
      }
    )
    const stop = h.subscribe()
    assert.equal(h.values.at(-1), null, 'Cache waits for permission validation')
    await flush()
    assert(h.values.at(-1))
    await h.tick(10 * 60_000)
    assert.equal(h.values.at(-1), null)
    assert.equal(h.positions.length, 0)
    await h.tick(5 * 60_000)
    assert.equal(h.positions.length, 1)
    assert(h.values.at(-1))
    stop()
  }
)
await check(
  'Vue enabled prop and effect-scope disposal cancel immediately',
  async () => {
    const pending = deferred(),
      h = harness({ fetch: () => pending.promise })
    const enabled = vue.shallowRef(false),
      scope = vue.effectScope()
    let result
    scope.run(() => {
      result = weatherModule.useLocalWeather(enabled, h.client)
    })
    assert.equal(h.positions.length, 0)
    enabled.value = true
    await flush()
    enabled.value = false
    assert.equal(result.weather.value, null)
    assert(h.requests[0].options.signal.aborted)
    assert.equal(h.timers.size, 0)
    enabled.value = true
    assert.equal(
      h.positions.length,
      1,
      'Re-enabling must obey the same throttle'
    )
    scope.stop()
    assert.equal(h.timers.size, 0)
    pending.resolve(response(payload()))
    await flush()
    assert.equal(result.weather.value, null)
  }
)
await check(
  'HMR restores only narrow cache and throttle, disposing the old module',
  async () => {
    const h = harness(),
      hot = {
        data: {},
        dispose(callback) {
          this.cleanup = callback
        },
      }
    const globals = {
      __hot: hot,
      navigator: {
        geolocation: h.deps.geolocation,
        permissions: h.deps.permissions,
      },
      globalThis: { fetch: h.deps.fetch },
      Date: class extends Date {
        static now() {
          return h.now()
        }
      },
      setTimeout: h.deps.setTimer,
      clearTimeout: h.deps.clearTimer,
    }
    const old = load(
      'src/composables/useLocalWeather.ts',
      dependencies,
      globals
    )
    const oldScope = vue.effectScope()
    oldScope.run(() => old.useLocalWeather(true))
    await flush()
    hot.cleanup(hot.data)
    assert.equal(h.timers.size, 0)
    assert.deepEqual(Object.keys(hot.data.localWeatherSnapshot).sort(), [
      'lastAttempt',
      'weather',
    ])
    assert(!JSON.stringify(hot.data).includes('latitude'))
    const fresh = load(
      'src/composables/useLocalWeather.ts',
      dependencies,
      globals
    )
    const newScope = vue.effectScope()
    let result
    newScope.run(() => {
      result = fresh.useLocalWeather(true)
    })
    await flush()
    assert.equal(h.positions.length, 1)
    assert.equal(result.weather.value.label, '多云')
    newScope.stop()
    oldScope.stop()
    hot.cleanup(hot.data)
    assert.equal(h.timers.size, 0)
  }
)

await check(
  'location validation and coordinate URL assembly stay in the service',
  () => {
    const position = {
      coords: { latitude: 35.123456, longitude: 112.654321 },
      timestamp: base,
    }
    const url = new URL(service.buildLocalWeatherUrl(position, base))
    assert.equal(url.searchParams.get('latitude'), '35.12')
    assert.equal(url.searchParams.get('longitude'), '112.65')
    assert.equal(url.searchParams.get('temperature_unit'), 'celsius')
    for (const invalid of [
      null,
      {},
      { coords: null, timestamp: base },
      { ...position, coords: { latitude: '35', longitude: 112 } },
      { ...position, coords: { latitude: 35, longitude: Infinity } },
      { ...position, timestamp: 0 },
      { ...position, timestamp: base - service.WEATHER_MAX_LOCATION_AGE_MS },
      { ...position, timestamp: base + 5 * 60_000 + 1 },
    ])
      assert.equal(service.buildLocalWeatherUrl(invalid, base), null)
    assert.equal(service.buildLocalWeatherUrl(position, NaN), null)
    assert.equal(service.buildLocalWeatherUrl(position, 0), null)
    const source = fs.readFileSync(
      path.join(root, 'src/composables/useLocalWeather.ts'),
      'utf8'
    )
    assert.doesNotMatch(
      source,
      /new URL|new URLSearchParams|latitude:|longitude:/
    )
  }
)
await check(
  'freshness boundaries, invalid clocks and impossible snapshots fail closed',
  () => {
    const real = service.parseCurrentWeather(payload(), base)
    assert(
      service.isWeatherFresh(
        { ...real, observedAt: base - service.WEATHER_MAX_AGE_MS + 1 },
        base
      )
    )
    assert(
      !service.isWeatherFresh(
        { ...real, observedAt: base - service.WEATHER_MAX_AGE_MS },
        base
      )
    )
    assert(
      service.isWeatherFresh({ ...real, observedAt: base + 5 * 60_000 }, base)
    )
    assert(
      !service.isWeatherFresh(
        { ...real, observedAt: base + 5 * 60_000 + 1 },
        base
      )
    )
    for (const now of [NaN, Infinity, 0, -1]) {
      assert.equal(service.parseCurrentWeather(payload(), now), null)
    }
    for (const invalid of [
      null,
      {},
      { ...real, temperatureCelsius: NaN },
      { ...real, weatherCode: 4 },
      { ...real, isDay: 'true' },
      { ...real, observedAt: base + 0.5 },
    ])
      assert.equal(service.validateLocalWeather(invalid, base), null)
    const narrow = service.validateLocalWeather(
      { ...real, label: '固定城市', latitude: 35, longitude: 112 },
      base
    )
    assert.equal(narrow.label, '多云')
    assert(!('latitude' in narrow) && !('longitude' in narrow))
    assert(Object.isFrozen(narrow))
  }
)
await check(
  'unsupported location never exposes even a fresh restored weather snapshot',
  async () => {
    const h = harness(
      { unsupported: true },
      {
        lastAttempt: base,
        weather: service.parseCurrentWeather(payload(), base),
      }
    )
    const stop = h.subscribe()
    await flush()
    assert(h.values.every(value => value === null))
    assert.equal(h.client.snapshot().weather, null)
    assert.equal(h.permissionQueries.length, 0)
    assert.equal(h.requests.length, 0)
    assert.equal(h.timers.size, 0)
    stop()
  }
)
await check(
  'invalid restored throttle and data cannot create infinite or negative timers',
  async () => {
    for (const lastAttempt of [Infinity, NaN, -1, base + 60_000]) {
      const h = harness(
        {},
        { lastAttempt, weather: { observedAt: base, temperatureCelsius: NaN } }
      )
      const stop = h.subscribe()
      assert.equal(h.client.snapshot().weather, null)
      await flush()
      assert.equal(h.positions.length, 1)
      assert(h.values.at(-1))
      assert(
        [...h.timers.values()].every(
          timer => Number.isFinite(timer.at) && timer.at > h.now()
        )
      )
      stop()
    }
  }
)
await check(
  'throwing WebView geolocation getter or absent abort capability does not break module import',
  async () => {
    for (const globals of [
      {
        navigator: {
          get geolocation() {
            throw new Error('Host permission absent')
          },
        },
      },
      {
        navigator: {
          geolocation: {
            getCurrentPosition() {
              assert.fail('No abort capability')
            },
          },
        },
        AbortController: undefined,
      },
    ]) {
      const module = load(
        'src/composables/useLocalWeather.ts',
        dependencies,
        globals
      )
      const scope = vue.effectScope()
      let result
      scope.run(() => {
        result = module.useLocalWeather(true)
      })
      await flush()
      assert.equal(result.weather.value, null)
      scope.stop()
    }
  }
)
await check(
  'explicitly denied host permission hides fresh cache without asking for location',
  async () => {
    const h = harness(
      { permissionStatus: permission('denied') },
      {
        lastAttempt: base,
        weather: service.parseCurrentWeather(payload(), base),
      }
    )
    const stop = h.subscribe()
    await flush()
    assert(h.values.every(value => value === null))
    assert.equal(h.positions.length, 0)
    assert.equal(h.requests.length, 0)
    assert.equal(h.timers.size, 0)
    assert.equal(h.client.snapshot().weather, null)
    assert.equal(h.permissionStatus.listeners.size, 1)
    stop()
    assert.equal(h.permissionStatus.listeners.size, 0)
  }
)
await check('主动重试重置定位权限一次并继续拉取天气', async () => {
  const reset = deferred()
  let resets = 0
  const h = harness({ permissionStatus: permission('denied'), resetPermission() { resets++; return reset.promise } })
  const stop = h.subscribe()
  await flush()
  assert.equal(h.client.problem.value, '定位未授权')
  h.client.refresh()
  h.client.refresh()
  assert.equal(resets, 1)
  assert.equal(h.positions.length, 0)
  reset.resolve()
  await flush()
  assert.equal(h.positions.length, 1)
  assert.equal(h.requests.length, 1)
  assert.equal(h.client.retrying.value, false)
  stop()
})
await check(
  'native host code=1 denial also disables retries when Permissions API cannot reflect it',
  async () => {
    const h = harness({
      noPermissions: true,
      locate: (_yes, no) => no({ code: 1 }),
    })
    const stop = h.subscribe()
    await flush()
    assert(h.values.every(value => value === null))
    assert.equal(h.timers.size, 0)
    await h.tick(30 * 60_000)
    assert.equal(h.positions.length, 1)
    assert.equal(h.requests.length, 0)
    stop()
  }
)
await check(
  'late native denial from a cancelled location cannot pause a newer successful generation',
  async () => {
    let calls = 0
    const h = harness({
      locate: yes => {
        if (++calls > 1)
          yes({
            coords: { latitude: 35, longitude: 112 },
            timestamp: base + 15 * 60_000,
          })
      },
    })
    const first = h.subscribe()
    await flush()
    first()
    await h.tick(15 * 60_000)
    const second = h.subscribe()
    await flush()
    assert(h.values.at(-1))
    h.positions[0].reject({ code: 1 })
    await flush()
    assert(h.values.at(-1))
    assert.equal(h.timers.size, 1)
    second()
  }
)
await check(
  'pending permission hides cached data and late permission cannot attach after cancellation',
  async () => {
    const pending = deferred(),
      status = permission()
    const h = harness(
      { queryPermission: () => pending.promise },
      {
        lastAttempt: base,
        weather: service.parseCurrentWeather(payload(), base),
      }
    )
    const stop = h.subscribe()
    await flush()
    h.client.refresh()
    assert.equal(h.permissionQueries.length, 1)
    assert(h.values.every(value => value === null))
    stop()
    assert.equal(h.timers.size, 0)
    pending.resolve(status)
    await flush()
    assert.equal(status.listeners.size, 0)
    assert.equal(h.positions.length, 0)
    assert(h.values.every(value => value === null))
  }
)
await check(
  'permission query deadline hides this round and ignores a late status',
  async () => {
    const pending = deferred(),
      status = permission('denied')
    const h = harness({ queryPermission: () => pending.promise })
    const stop = h.subscribe()
    await h.tick(8_000)
    assert.equal(h.positions.length, 0)
    assert(h.values.every(value => value === null))
    pending.resolve(status)
    await flush()
    assert.equal(status.listeners.size, 0)
    assert.equal(h.positions.length, 0)
    stop()
    assert.equal(h.timers.size, 0)
  }
)
await check(
  'missing or rejecting Permissions API uses only a successful native position, never a city fallback',
  async () => {
    for (const overrides of [
      { noPermissions: true },
      {
        queryPermission: async () => {
          throw new Error('Descriptor unsupported')
        },
      },
    ]) {
      const h = harness(overrides),
        stop = h.subscribe()
      assert.equal(h.values.at(-1), null)
      await flush()
      assert.equal(h.positions.length, 1)
      assert.equal(h.values.at(-1).label, '多云')
      stop()
      assert.equal(h.timers.size, 0)
    }
    const h = harness({
      noPermissions: true,
      locate: (_yes, no) => no({ code: 1 }),
    })
    const stop = h.subscribe()
    await flush()
    assert(h.values.every(value => value === null))
    assert.equal(h.requests.length, 0)
    stop()
  }
)
await check(
  'permission revocation hides immediately and stops automatic re-prompting',
  async () => {
    const h = harness(),
      stop = h.subscribe()
    await flush()
    assert(h.values.at(-1))
    h.permissionStatus.change('prompt')
    assert.equal(h.values.at(-1), null)
    assert.equal(h.client.snapshot().weather, null)
    assert.equal(h.timers.size, 0)
    await h.tick(30 * 60_000)
    assert.equal(h.positions.length, 1)
    h.permissionStatus.change('granted')
    await flush()
    assert.equal(h.positions.length, 2)
    assert(h.values.at(-1))
    stop()
    assert.equal(h.permissionStatus.listeners.size, 0)
  }
)
await check(
  'permission denial cancels in-flight fetch, and late response is not even read as JSON',
  async () => {
    const pending = deferred()
    let jsonCalls = 0
    const h = harness({ fetch: () => pending.promise }),
      stop = h.subscribe()
    await flush()
    h.permissionStatus.change('denied')
    assert(h.requests[0].options.signal.aborted)
    assert.equal(h.timers.size, 0)
    pending.resolve({
      ok: true,
      json: async () => {
        jsonCalls++
        return payload()
      },
    })
    await flush()
    assert.equal(jsonCalls, 0)
    assert(h.values.every(value => value === null))
    stop()
  }
)
await check(
  'grant notification during a native request never creates a duplicate request',
  async () => {
    const h = harness({ permissionStatus: permission('prompt'), locate() {} }),
      stop = h.subscribe()
    await flush()
    assert.equal(h.positions.length, 1)
    h.permissionStatus.change('granted')
    h.permissionStatus.change('granted')
    h.positions[0].resolve({
      coords: { latitude: 35, longitude: 112 },
      timestamp: base,
    })
    await flush()
    assert.equal(h.positions.length, 1)
    assert.equal(h.requests.length, 1)
    assert(h.values.at(-1))
    stop()
  }
)
await check(
  'late fetch after unsubscribe does not start body parsing or restore weather',
  async () => {
    const pending = deferred()
    let jsonCalls = 0
    const h = harness({ fetch: () => pending.promise }),
      stop = h.subscribe()
    await flush()
    stop()
    pending.resolve({
      ok: true,
      json: async () => {
        jsonCalls++
        return payload()
      },
    })
    await flush()
    assert.equal(jsonCalls, 0)
    assert(h.values.every(value => value === null))
    assert.equal(h.timers.size, 0)
    assert.equal(h.permissionStatus.listeners.size, 0)
  }
)
await check(
  'manual refresh clears old data and coalesces repeated in-flight refreshes without timer leakage',
  async () => {
    const pending = deferred()
    let calls = 0,
      jsonCalls = 0
    const h = harness({
      fetch: (_url, _options, now) =>
        ++calls === 1 ? response(payload(now)) : pending.promise,
    })
    const stop = h.subscribe()
    await flush()
    assert(h.values.at(-1))
    h.client.refresh()
    assert.equal(h.values.at(-1), null)
    await flush()
    for (let index = 0; index < 5; index++) h.client.refresh()
    assert.equal(h.positions.length, 2)
    assert.equal(h.requests.length, 2)
    assert.equal(h.timers.size, 1)
    assert.equal(h.requests[1].options.redirect, 'error')
    await h.tick(8_000)
    assert(h.requests[1].options.signal.aborted)
    pending.resolve({
      ok: true,
      json: async () => {
        jsonCalls++
        return payload(h.now())
      },
    })
    await flush()
    assert.equal(jsonCalls, 0)
    assert.equal(h.values.at(-1), null)
    stop()
    assert.equal(h.timers.size, 0)
  }
)
await check(
  'auto-refresh hides previous real data throughout new location acquisition',
  async () => {
    let calls = 0
    const h = harness({
      locate: yes => {
        if (++calls === 1)
          yes({ coords: { latitude: 35, longitude: 112 }, timestamp: base })
      },
    })
    const stop = h.subscribe()
    await flush()
    assert(h.values.at(-1))
    await h.tick(15 * 60_000)
    assert.equal(h.positions.length, 2)
    assert.equal(h.values.at(-1), null)
    h.client.refresh()
    assert.equal(h.positions.length, 2)
    stop()
    assert.equal(h.timers.size, 0)
  }
)
await check(
  'identical listeners are independent subscriptions and cancellation is idempotent',
  async () => {
    const h = harness()
    const listener = weather => h.values.push(weather)
    const first = h.client.subscribe(listener),
      second = h.client.subscribe(listener)
    await flush()
    assert.equal(h.requests.length, 1)
    assert.equal(h.permissionQueries.length, 1)
    first()
    first()
    assert.equal(h.timers.size, 1)
    assert.equal(h.permissionStatus.listeners.size, 1)
    second()
    assert.equal(h.timers.size, 0)
    assert.equal(h.permissionStatus.listeners.size, 0)
  }
)
await check(
  'client disposal forgets cached weather and is final/idempotent',
  async () => {
    const h = harness(),
      stop = h.subscribe()
    await flush()
    assert(h.client.snapshot().weather)
    h.client.dispose()
    h.client.dispose()
    assert.equal(h.client.snapshot().weather, null)
    assert.equal(h.values.at(-1), null)
    h.client.refresh()
    h.subscribe()()
    assert.equal(h.positions.length, 1)
    assert.equal(h.timers.size, 0)
    assert.equal(h.permissionStatus.listeners.size, 0)
    stop()
  }
)
await check(
  'composable ignores callbacks retained by a cancelled client or disposed scope',
  () => {
    const callbacks = [],
      real = service.parseCurrentWeather(payload(), base)
    let refreshes = 0
    const client = {
      subscribe: callback => {
        callbacks.push(callback)
        return () => {}
      },
      refresh: () => {
        refreshes++
      },
    }
    const enabled = vue.shallowRef(true),
      scope = vue.effectScope()
    let result
    scope.run(() => {
      result = weatherModule.useLocalWeather(enabled, client)
    })
    callbacks[0](real)
    assert.equal(result.weather.value.label, '多云')
    enabled.value = false
    enabled.value = true
    callbacks[0](real)
    assert.equal(result.weather.value, null)
    callbacks[1](real)
    assert.equal(result.weather.value.label, '多云')
    scope.stop()
    callbacks[1](real)
    assert.equal(result.weather.value, null)
    result.refresh()
    assert.equal(refreshes, 0)
  }
)
await check(
  'synchronous disabling within subscribe releases the returned subscription',
  () => {
    const enabled = vue.shallowRef(true),
      scope = vue.effectScope()
    let cancellations = 0,
      result
    const client = {
      subscribe(callback) {
        callback(service.parseCurrentWeather(payload(), base))
        enabled.value = false
        return () => {
          cancellations++
        }
      },
      refresh() {},
    }
    scope.run(() => {
      result = weatherModule.useLocalWeather(enabled, client)
    })
    assert.equal(result.weather.value, null)
    assert.equal(cancellations, 1)
    scope.stop()
  }
)
await check(
  'titlebar and fullscreen composable consumers share one request and independent enable lifetimes',
  async () => {
    const h = harness(),
      titlebar = vue.effectScope(),
      fullscreen = vue.effectScope()
    const enabled = vue.shallowRef(true)
    let first, second
    titlebar.run(() => {
      first = weatherModule.useLocalWeather(true, h.client)
    })
    fullscreen.run(() => {
      second = weatherModule.useLocalWeather(enabled, h.client)
    })
    await flush()
    assert.equal(h.positions.length, 1)
    assert.equal(h.requests.length, 1)
    assert.equal(first.weather.value.label, second.weather.value.label)
    enabled.value = false
    assert.equal(second.weather.value, null)
    assert(first.weather.value)
    assert.equal(h.timers.size, 1)
    fullscreen.stop()
    titlebar.stop()
    assert.equal(h.timers.size, 0)
    assert.equal(h.permissionStatus.listeners.size, 0)
  }
)
await check(
  'weather feature neither stores position nor logs sensitive responses',
  () => {
    for (const relative of [
      'src/services/local-weather.ts',
      'src/composables/useLocalWeather.ts',
      'src/components/player/LocalWeather.vue',
    ]) {
      const source = fs.readFileSync(path.join(root, relative), 'utf8')
      assert.doesNotMatch(
        source,
        /localStorage|sessionStorage|indexedDB|console\s*\.|watchPosition\s*\(|v-html/
      )
    }
  }
)

const componentSource = fs.readFileSync(
  path.join(root, 'src/components/player/LocalWeather.vue'),
  'utf8'
)
await check(
  'transition uses appear with enter-only 200ms fade/translate, immediate hiding and reduced-motion fallback',
  () => {
    assert.match(
      componentSource,
      /<Transition[^>]*name="local-weather"[^>]*appear[^>]*:css="props\.motion && preferredMotion !== 'reduce'"/
    )
    assert.match(componentSource, /v-if="props.enabled && pill"/)
    assert.match(componentSource, /@leave="leaveImmediately"/)
    assert.match(
      componentSource,
      /transition:\s*opacity 200ms ease,\s*transform 200ms ease/
    )
    assert.match(
      componentSource,
      /\.local-weather-enter-from\s*\{\s*opacity: 0;\s*transform: translateY\(-3px\)/
    )
    assert.match(componentSource, /@media \(prefers-reduced-motion: reduce\)/)
    assert.match(
      componentSource,
      /\.local-weather-leave-active\s*\{\s*transition: none/
    )
    assert.match(
      componentSource,
      /\.local-weather-enter-from\s*\{\s*opacity: 1;\s*transform: none/
    )
    assert.match(componentSource, /variant\?: 'titlebar' \| 'fullscreen'/)
    assert.doesNotMatch(
      componentSource,
      /transition:\s*(all|width|height|margin|padding)/
    )
    assert.doesNotMatch(componentSource, /加载|获取中|演示数据|19°|wx-loc/)
    assert.match(componentSource, /用户当前位置实时天气/)
  }
)
await check(
  'compiled component preserves titlebar/fullscreen variants, truthful icons and reduced motion',
  async () => {
    const parsed = sfc.parse(componentSource)
    assert.equal(parsed.errors.length, 0)
    const script = sfc.compileScript(parsed.descriptor, {
      id: 'weather-check',
      inlineTemplate: true,
    })
    const weather = vue.shallowRef(null),
      motion = vue.shallowRef('no-preference'),
      transitions = []
    const Transition = vue.defineComponent({
      props: {
        name: String,
        appear: Boolean,
        css: Boolean,
        onLeave: Function,
      },
      setup(props, { slots }) {
        return () => {
          transitions.push({ ...props })
          return slots.default?.()[0]
        }
      },
    })
    const module = { exports: {} }
    vm.runInNewContext(compile(script.content), {
      exports: module.exports,
      module,
      Date,
      require: name =>
        ({
          vue: { ...vue, Transition },
          '@vueuse/core': { usePreferredReducedMotion: () => motion },
          '@/composables/useLocalWeather': {
            useLocalWeather: () => ({ weather, problem: vue.ref(''), retrying: vue.ref(false), refresh() {} }),
          },
          '@/services/local-weather': service,
        })[name],
    })
    const node = (type, text = '') => ({
      type,
      text,
      children: [],
      attrs: {},
      parent: null,
    })
    const renderer = vue.createRenderer({
      patchProp: (element, key, _old, value) => {
        element.attrs[key] = value
      },
      createElement: type => node(type),
      createText: text => node('text', text),
      createComment: text => node('comment', text),
      setText: (element, text) => {
        element.text = text
      },
      setElementText: (element, text) => {
        element.text = text
        element.children = []
      },
      parentNode: element => element.parent,
      nextSibling: element =>
        element.parent?.children[
          element.parent.children.indexOf(element) + 1
        ] ?? null,
      insert(element, parent, anchor = null) {
        if (element.parent)
          element.parent.children.splice(
            element.parent.children.indexOf(element),
            1
          )
        const index = anchor ? parent.children.indexOf(anchor) : -1
        parent.children.splice(
          index < 0 ? parent.children.length : index,
          0,
          element
        )
        element.parent = parent
      },
      remove(element) {
        element.parent?.children.splice(
          element.parent.children.indexOf(element),
          1
        )
        element.parent = null
      },
    })
    const container = node('root')
    const visible = () => container.children.find(child => child.type === 'div')
    const render = (enabled, variant) =>
      renderer.render(
        vue.h(module.exports.default, { enabled, variant }),
        container
      )
    render(true)
    assert.equal(visible(), undefined)
    weather.value = service.parseCurrentWeather(payload(), base)
    await vue.nextTick()
    assert.equal(visible().attrs.role, 'img')
    assert.match(visible().attrs.class, /weather-pill/)
    assert.match(
      visible().children.find(child => child.type === 'svg').attrs.class,
      /h-\[29px\]/
    )
    assert.match(visible().attrs['aria-label'], /用户当前位置实时天气/)
    assert.match(visible().attrs.title, /Open-Meteo/)
    assert(
      visible().children.some(
        child => child.type === 'span' && child.text === '18°'
      )
    )
    assert(
      visible().children.some(
        child => child.type === 'span' && child.text === '多云'
      )
    )
    assert.equal(transitions.at(-1).appear, true)
    assert.equal(transitions.at(-1).css, true)
    weather.value = { ...weather.value, nearbyCity: '杭州' }
    await vue.nextTick()
    assert.match(visible().attrs['aria-label'], /杭州附近/)
    assert(visible().children.some(child => child.text === '杭州附近'))
    motion.value = 'reduce'
    await vue.nextTick()
    assert.equal(transitions.at(-1).css, false)
    let leftImmediately = false
    transitions.at(-1).onLeave({}, () => {
      leftImmediately = true
    })
    assert.equal(
      leftImmediately,
      true,
      'Invalid weather must not linger for CSS leave frames'
    )
    render(true, 'fullscreen')
    await vue.nextTick()
    assert.match(visible().attrs.class, /fs-weather/)
    assert.doesNotMatch(visible().attrs.class, /weather-pill/)
    const icon = () => visible().children.find(child => child.type === 'svg')
    assert.match(icon().attrs.class, /wx-icon-sm/)
    assert.match(icon().attrs.class, /h-\[23px\]/)
    weather.value = service.parseCurrentWeather(
      payload(base, { weather_code: 65, is_day: 1 }),
      base
    )
    await vue.nextTick()
    assert.equal(
      icon().children.filter(child => child.type === 'g').length,
      0,
      'Rain must not imply sunshine'
    )
    assert(icon().children.some(child => child.attrs.stroke === '#A7D9FF'))
    weather.value = service.parseCurrentWeather(
      payload(base, { weather_code: 0, is_day: 0 }),
      base
    )
    await vue.nextTick()
    assert.match(visible().attrs['aria-label'], /夜晚，晴/)
    assert.equal(icon().children.filter(child => child.type === 'g').length, 1)
    weather.value = null
    await vue.nextTick()
    assert.equal(visible(), undefined, 'No invalid-data fallback in fullscreen')
    weather.value = service.parseCurrentWeather(payload(), base)
    await vue.nextTick()
    render(false, 'fullscreen')
    await vue.nextTick()
    assert.equal(visible(), undefined)
    renderer.render(null, container)
  }
)
console.log(
  `Weather checks passed (${count}); all locations/weather are mocks, not live permission validation.`
)
