import assert from 'node:assert/strict'

// 在隔离的浏览器中注入更新状态，验收真实标题栏与气泡的渲染和命令分派。
export async function checkUpdateTitlebar({ evaluate, waitFor, key, resize, capture }) {
  const trigger = "document.querySelector('[data-update-trigger]')"
  const prompt = "document.querySelector('[data-update-prompt]')"
  const viewport = await evaluate('[innerWidth, innerHeight]')
  await waitFor('主窗口标题栏已挂载', "!!document.querySelector('[data-titlebar-settings]')")
  await evaluate(`(async () => {
    const updater = (await import('/src/stores/app-updater.ts')).useAppUpdaterStore()
    const { state: { settings } } = (await import('/src/stores/player.ts')).usePlayerStore()
    await updater.start()
    const snapshot = { ...updater.state }
    const { command, openRelease } = updater
    const { motion, glassStyle } = settings
    const calls = []
    updater.command = async action => {
      calls.push(action)
      if (action === 'dismiss' || action === 'defer') updater.state.dismissed = true
      if (action === 'defer') updater.state.deferred = true
      if (action === 'download') updater.state.phase = 'downloading'
      if (action === 'install') updater.state.phase = 'installing'
    }
    updater.openRelease = async () => { calls.push('openRelease') }
    window.updateTitleFixture = {
      state: updater.state, settings, calls,
      restore() {
        Object.assign(updater.state, snapshot)
        Object.assign(updater, { command, openRelease })
        Object.assign(settings, { motion, glassStyle })
      },
    }
  })()`)

  // 状态注入只作用于当前独立测试浏览器，显式清除上一次模拟的下载结果。
  async function setState(value) {
    await evaluate(`Object.assign(window.updateTitleFixture.state, ${JSON.stringify(value)}); true`)
  }
  const colors = []
  try {
    await setState({ phase: 'latest', version: '' })
    await waitFor('没有新版本时收起更新图标', `!${trigger}`)
    await setState({ phase: 'available', version: '1.2.3', reason: 'manual' })
    await waitFor('手动安装包显示查看新版本', `${trigger}?.title.includes('查看新版本')`)
    await evaluate(`${trigger}.click()`)
    assert.equal(await evaluate("updateTitleFixture.calls.at(-1)"), 'openRelease')

    await setState({ phase: 'available', reason: '', downloaded: 0, total: 0, dismissed: false, deferred: false })
    await evaluate(`${trigger}.focus()`)
    await key('Enter', 13)
    await waitFor('按回车触发下载', "updateTitleFixture.calls.at(-1) === 'download'")
    await waitFor('未知长度使用不定进度', `!!${trigger}.querySelector('[role=progressbar]:not([aria-valuenow])')`)
    await setState({ downloaded: 5, total: 10 })
    await waitFor('标题栏下载进度显示百分比', `${trigger}.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '50'`)
    await setState({ phase: 'ready' })
    await waitFor('更新就绪后展开且保留键盘焦点', `!!${prompt} && document.activeElement === ${trigger}`)
    await resize(900, 620)
    for (const [setting, style] of [['frosted', 'glass'], ['liquid', 'liquid']]) {
      await evaluate(`updateTitleFixture.settings.glassStyle = '${setting}'`)
      await waitFor('气泡从窗口根层取景 ' + style, `${prompt}?.parentElement?.matches('.${style}-win > [data-player]')`)
      await waitFor('气泡在窗口内与图标对齐 ' + style, `(() => {
        const panel = ${prompt}, anchor = ${trigger}.getBoundingClientRect(), rect = panel.getBoundingClientRect()
        return getComputedStyle(panel).opacity === '1' && !panel.getAnimations().length
          && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
          && Math.abs(rect.right - anchor.right) < 2 && rect.top >= anchor.bottom
      })()`)
      colors.push(await evaluate(`getComputedStyle(${prompt}).backgroundImage`))
      await capture?.('update-prompt-' + style)
    }
    assert.notEqual(colors[0], colors[1])
    await evaluate(`${trigger}.click(); ${trigger}.click()`)
    await waitFor('关闭回执不覆盖立即重开的气泡', `${trigger}.getAttribute('aria-expanded') === 'true' && document.activeElement.textContent === '稍后'`)
    await evaluate(`${trigger}.focus()`)
    await key('Tab', 9)
    await waitFor('气泡按 Tab 到稍后', "document.activeElement?.textContent === '稍后'")
    await key('Enter', 13)
    await waitFor('稍后保留入口并归还焦点', `!${prompt} && document.activeElement === ${trigger} && updateTitleFixture.calls.at(-1) === 'defer'`)
    await key('Enter', 13)
    await waitFor('重新展开后落在稍后', `!!${prompt} && document.activeElement.textContent === '稍后'`)
    await key('Escape', 27)
    await waitFor('Escape 收起并还原焦点', `!${prompt} && document.activeElement === ${trigger}`)
    await evaluate(`${trigger}.click(); ${trigger}.click(); ${trigger}.click()`)
    await waitFor('快速开关保留最后一次意图', `${trigger}.getAttribute('aria-expanded') === 'true' && !!${prompt}`)
    await evaluate("document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))")
    await waitFor('窗口其他位置收起气泡', `!${prompt} && updateTitleFixture.calls.at(-1) === 'dismiss'`)

    await evaluate(`updateTitleFixture.settings.motion = false; ${trigger}.click()`)
    await waitFor('关闭动效后气泡使用静态样式', `${prompt}?.classList.contains('update-calm') && !${prompt}.getAnimations().length`)
    await key('Tab', 9)
    await waitFor('焦点移到立即更新', "document.activeElement?.textContent === '立即更新'")
    await key('Enter', 13)
    await waitFor('显式确认才派发安装命令', `updateTitleFixture.calls.filter(action => action === 'install').length === 1 && ${trigger}?.title === '正在安装更新'`)
    await setState({ phase: 'error', errorStage: 'install', error: '模拟安装失败' })
    await waitFor('安装失败可重试原安装', `${trigger}.title.includes('重试安装')`)
    await evaluate(`${trigger}.click()`)
    assert.equal(await evaluate("updateTitleFixture.calls.at(-1)"), 'install')
  } finally {
    await evaluate('updateTitleFixture.restore(); delete window.updateTitleFixture')
    await resize(...viewport)
  }
}
