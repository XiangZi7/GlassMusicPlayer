import assert from 'node:assert/strict'

// 真实浏览器使用隔离样本，检查搜索、字体、平台入口与红心的请求归属。
export async function checkLibraryControls({
  evaluate,
  waitFor,
  key,
  resize,
  send,
  capture,
  favoriteRequests,
}) {
  const top = "document.querySelector('[data-top-search]')"
  const page = "document.querySelector('[data-search-input]')"
  const bubble = "document.querySelector('.search-history')"
  const words = `[...${bubble}.querySelectorAll('[role=option]')].map(el => el.textContent.trim())`
  await waitFor('标题栏已挂载', `!!${top}`)
  await waitFor(
    '搜索框已完成窗口布局',
    `${top}.closest('[data-player]').clientHeight > 160 && ${top}.clientWidth > 0`
  )
  await evaluate(`${top}.focus(); ${top}.click()`)
  await waitFor(
    '首次聚焦显示空态',
    `${bubble}?.textContent.includes('暂无搜索记录')`
  ).catch(async error => {
    console.error(
      await evaluate(
        `(() => { const el = ${top}, f=el.closest('form'); return {focus:document.activeElement?.outerHTML.slice(0,150),state:el.getAttribute('aria-expanded'),box:f.getBoundingClientRect().toJSON(),frame:f.closest('[data-player]').getBoundingClientRect().toJSON(),text:${bubble}?.textContent} })()`
      )
    )
    throw error
  })
  const search = async (selector, word) => {
    await evaluate(
      `(() => {const el = ${selector}; el.focus(); el.value = ${JSON.stringify(word)}; el.dispatchEvent(new Event('input', {bubbles:true}))})()`
    )
    await key('Enter', 13)
    await waitFor('已提交并收起历史', `!!${page} && !${bubble}`)
  }
  await search(top, '海边')
  await search(page, 'Album')
  await search(page, '  album ')
  const initialLoad = await evaluate('performance.timeOrigin')
  await send('Page.reload')
  await waitFor(
    '重载后搜索页就绪',
    `performance.timeOrigin !== ${initialLoad} && ${page}?.clientWidth > 0 && ${top}?.clientWidth > 0`
  )
  await evaluate(`${top}.focus(); ${top}.click()`)
  await waitFor(
    '历史跨入口、去重并保留最近顺序',
    `${bubble} && JSON.stringify(${words}) === '["album","海边"]'`
  )
  await key('ArrowDown', 40)
  await key('ArrowDown', 40)
  await key('Enter', 13)
  await waitFor('键盘重搜已选词', `${top}.value === '海边' && !${bubble}`)
  await evaluate(
    "(async () => { window.controlsStore = (await import('/src/stores/player.ts')).usePlayerStore() })()"
  )
  for (const material of ['frosted', 'liquid']) {
    await evaluate(
      `controlsStore.state.settings.glassStyle = '${material}'; ${top}.click()`
    )
    await waitFor(
      '气泡材质和边界 ' + material,
      `(() => {
      const b = ${bubble}; if (!b) return false; const css = getComputedStyle(b), r = b.getBoundingClientRect();
      return b.parentElement.matches('[data-player]') && r.left >= 0 && r.right <= innerWidth &&
        css.backdropFilter.includes('blur') && css.backgroundImage.includes('gradient') === ${material === 'liquid'}
    })()`
    )
    await waitFor(
      '气泡已完成过渡',
      `getComputedStyle(${bubble}).opacity === '1' && !${bubble}.getAnimations().length && !document.querySelector('.search-history-enter-from, .search-history-enter-active')`
    )
    const aligned = `Math.abs(${bubble}.getBoundingClientRect().left - ${top}.closest('form').getBoundingClientRect().left) < 2`
    await evaluate("document.querySelector('.titlebar-account-actions').style.paddingRight = '24px'")
    await waitFor('同栏控件宽度改变时气泡跟随', aligned)
    await evaluate("document.querySelector('.titlebar-account-actions').style.removeProperty('padding-right')")
    await waitFor('气泡重新对齐搜索框', aligned)
    await capture('history-' + material)
    await key('Escape', 27)
    await waitFor(
      'Escape 保留输入焦点',
      `document.activeElement === ${top} && !${bubble}`
    )
  }
  await evaluate(`${top}.click();`)
  await waitFor(
    '可清空最近记录',
    "!!document.querySelector('[aria-label=清空搜索历史]')"
  )
  await evaluate("document.querySelector('[aria-label=清空搜索历史]').click()")
  await waitFor(
    '清空只影响搜索历史',
    `${bubble}?.textContent.includes('暂无搜索记录') && controlsStore.state.query === '海边'`
  )
  await evaluate("location.hash = '#/upload'")
  const form = "document.querySelector('.up-form')"
  await waitFor('手动登记小节', `!!${form}`)
  for (const width of [1317, 680]) {
    await resize(width, 835)
    await waitFor(
      '登记表等字号且没有横向溢出',
      `(() => { const f=${form}, controls=[...f.querySelectorAll('input, button')];
      return f.scrollWidth <= f.clientWidth + 1 && controls.every(el => getComputedStyle(el).fontSize === '13px' && getComputedStyle(el).lineHeight === '20px') })()`
    )
    if (width === 1317) {
      await evaluate(`${form}.scrollIntoView({block:'center'})`)
      await capture('local-registration')
    }
  }
  await evaluate("location.hash = '#/downloads'")
  await waitFor(
    '下载工具栏等字号且文字状态小于数值',
    `(() => {
    const panel = document.querySelector('[data-panel=downloads]'); if (!panel) return false;
    return [...panel.querySelectorAll('.import-actions button')].every(b => getComputedStyle(b).fontSize === '13px') &&
      getComputedStyle(panel.querySelector('.stat-text')).fontSize === '16px' && panel.scrollWidth <= panel.clientWidth + 1
  })()`
  )
  await waitFor('下载标签滑块已到位', `(() => {
    const tabs = document.querySelector('[data-panel=downloads] .pg-tabs')
    const target = tabs.querySelector('[data-slide-value=downloads]').getBoundingClientRect()
    const pill = tabs.querySelector('[data-slide-pill]').getBoundingClientRect()
    return Math.abs(target.left - pill.left) < 2 && Math.abs(target.right - pill.right) < 2
  })()`)
  await capture('downloads')
  await resize(1240, 820)
  for (const platform of ['kuwo', 'netease', 'kugou']) {
    await evaluate(`location.hash = '#/connect?platform=${platform}'`)
    const dialog = "document.querySelector('#platform-connection-dialog')"
    await waitFor(
      '连接方式 ' + platform,
      `(() => {
      const d=${dialog}; if (!d?.getBoundingClientRect().height) return false;
      return !!d.querySelector('input[type=text]') === ${platform === 'kuwo'} &&
        !!d.querySelector('input[value=login]') === ${platform === 'netease'} &&
        !!d.querySelector('[aria-label=扫码登录]') === ${platform !== 'kuwo'}
    })()`
    )
    await key('Escape', 27)
  }
  await evaluate(`(async () => {
    const auth = await import('/src/services/player/playback-session.ts')
    const profile = {userId:'11', displayName:'样本', avatarUrl:null}
    await auth.acceptPlaybackGrant(profile, {token:'a'.repeat(43), expiresAt:new Date(Date.now()+60000).toISOString(), favorites:true})
    window.likeTracks = controlsStore.registerCatalogTracks([['netease','17'], ['kuwo','17'], ['netease','19']].map(([platform,id]) => ({
      platform, id, title:'红心样本'+id, artists:['样本'], durationMs:20000, sourceUrl:'', coverUrl:null
    })))
    controlsStore.state.idx = likeTracks[0]
    location.hash='#/liked'
  })()`)
  const heart = "document.querySelector('.win-bottom [data-like]')"
  await waitFor('原生心形按钮可用', `!!${heart} && !${heart}.disabled`)
  await evaluate(`${heart}.click()`)
  await waitFor('第一首已喜欢', 'controlsStore.state.liked[likeTracks[0]]')
  await evaluate(
    `${heart}.click(); controlsStore.state.idx = likeTracks[1]; ${heart}.click(); controlsStore.state.idx = likeTracks[2]; ${heart}.click()`
  )
  await waitFor(
    '平台拒绝后回退，其他平台收藏保留',
    'controlsStore.state.liked[likeTracks[2]] === false && controlsStore.state.liked[likeTracks[1]]'
  )
  assert.deepEqual(
    favoriteRequests
      .filter(([path]) => path.endsWith('/17'))
      .map(([, liked]) => liked),
    [true, false]
  )
  assert(
    favoriteRequests.every(
      ([path, , auth]) =>
        path.startsWith('/api/v1/netease/auth/favorites/') &&
        auth === 'Bearer ' + 'a'.repeat(43)
    )
  )
  console.log(
    'PASS 搜索历史持久化、键盘与双材质，登记和下载字号，三平台连接入口及收藏请求与回退'
  )
}
