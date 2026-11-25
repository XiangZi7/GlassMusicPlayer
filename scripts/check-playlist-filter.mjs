import assert from 'node:assert/strict'

// 在隔离浏览器中复现导入歌单，验证跨页搜索、真实点播位置和两种玻璃材质。
export async function checkPlaylistFilter({ evaluate, waitFor, send, key, resize }) {
  const root = "document.querySelector('[data-panel=playlist]')"
  const input = `${root}?.querySelector('.playlist-filter input')`
  const rows = `[...${root}.querySelectorAll('.trow b')].map(el => el.textContent)`
  const clear = `${root}.querySelector('[aria-label="清空歌单搜索"]')`
  const first = "document.querySelector('[data-custom=\"netease:101\"]')"
  const second = "document.querySelector('[data-custom=\"kuwo:102\"]')"

  // 使用页面输入事件实时筛选，不触发全站搜索提交。
  async function filter(text) {
    await evaluate(`(() => { const el = ${input}; el.focus(); el.value = ${JSON.stringify(text)};
      el.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  }
  const samples = Array.from({ length: 662 }, (_, i) => ({
    platform: 'netease', id: String(10001 + i), title: i === 661 ? 'Blinding Lights' : '样本 ' + i,
    artists: [i >= 660 ? 'The Weeknd' : '样本歌手'], album: i >= 660 ? '晚间专辑' : '日间专辑',
    subtitle: i === 660 ? '电影主题曲' : null, durationMs: 200000, coverUrl: null, sourceUrl: '',
  }))
  const lists = [
    { platform: 'netease', id: '101', title: '测试歌单', tracks: samples },
    { platform: 'kuwo', id: '102', title: '另一份歌单', tracks: [{ ...samples[0], platform: 'kuwo' }] },
  ]
  await evaluate(`localStorage.setItem('miraiMusic.publicPlaylists.v1', ${JSON.stringify(JSON.stringify(lists))})`)
  for (const style of ['glass', 'liquid']) {
    const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.setItem('miraiMusic.preferences.v1', JSON.stringify({version:1,settings:{glassStyle:'${style}'}}))`,
    })
    await send('Page.reload', { ignoreCache: true })
    await waitFor('已载入独立样本和材质', `!!${first}?.closest('.${style}-win')`)
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    await evaluate(`${first}.click()`)
    await waitFor('导入歌单的搜索框', `!!${input} && ${root}.querySelector('[data-pl-meta]').textContent.includes('662')`)
    await filter('BLINDING')
    await waitFor('从完整歌单命中末尾曲目', `${rows}.join() === 'Blinding Lights'`)
    const appearance = await evaluate(`(() => { const el = ${input}; const box = getComputedStyle(el.parentElement);
      return [box.outlineStyle, getComputedStyle(el).outlineStyle, box.backgroundImage !== 'none'] })()`)
    assert.deepEqual(appearance, ['none', 'none', style === 'liquid'])
    await key('Escape', 27)
    await waitFor('Escape 恢复曲目并留在输入框', `document.activeElement === ${input} && !${input}.value && ${rows}.length === 10`)
  }
  await evaluate(`${root}.querySelector('[aria-label="下一页"]').click()`)
  await waitFor('原歌单第二页', `${rows}[0] === '样本 10'`)
  await filter('样本')
  await waitFor('新搜索从第一页开始', `${rows}[0] === '样本 0'`)
  await filter('电影主题曲')
  await waitFor('按作品说明匹配', `${rows}.join() === '样本 660'`)
  await filter('  晚间专辑   WEEKND ')
  await waitFor('歌手和专辑组合搜索', `${rows}.length === 2`)
  await evaluate(`${root}.querySelector('[data-slide-value="pl:title"]').click()`)
  await waitFor('按歌名排列筛选结果', `${rows}[0] === 'Blinding Lights'`)
  await evaluate(`${root}.querySelector('.banner-play').click()`)
  await waitFor('从排序后的首个命中点播', `${root}.querySelector('.trow.on b')?.textContent === 'Blinding Lights'`)
  await evaluate(`${root}.querySelectorAll('.trow')[1].click()`)
  await waitFor('点播保留原始曲目索引', `${root}.querySelector('.trow.on b')?.textContent === '样本 660'`)
  await evaluate("document.querySelector('.win-bottom button[aria-label=播放队列]').click()")
  await waitFor('搜索结果组成两首的队列', "document.querySelectorAll('.main-queue .qrow').length === 2")
  await evaluate("document.querySelector('[aria-label=关闭播放队列]').click()")
  await filter('没有匹配-1000')
  await waitFor('零命中保留搜索入口', `${root}.textContent.includes('这份歌单里没有匹配的歌曲') && ${root}.querySelector('.banner-play').disabled`)
  await evaluate(`${clear}.click()`)
  await waitFor('清空后焦点回到输入框', `document.activeElement === ${input} && ${rows}.length === 10`)
  await filter('WEEKND')
  await evaluate(`${second}.click()`)
  await waitFor('切换平台歌单独立筛选', `!!${input} && !${input}.value && ${rows}.length === 1`)
  await resize(660, 640)
  assert.ok(await evaluate(`${input}.getBoundingClientRect().right <= window.innerWidth`))
  // 公开详情沿用真实平台和歌单 ID，搜索全部已读取的分页。
  await evaluate("location.hash = '#/discovery/netease/3779629'")
  const discover = "document.querySelector('[data-panel=discovery]')"
  await waitFor('公开歌单加载完成', `!!${discover}?.querySelector('.playlist-filter input')`)
  await evaluate(`(() => { const el = ${discover}.querySelector('input'); el.value = 'netease3779629136'; el.dispatchEvent(new Event('input', {bubbles:true})) })()`)
  await waitFor('公开歌单末页可搜索', `${discover}.querySelector('.trow b')?.textContent === 'netease3779629136' && ${discover}.querySelectorAll('.trow').length === 1`)
  console.log('歌单内搜索的 662 首导入曲目、公开详情、播放队列、键盘和双材质验证通过')
}
