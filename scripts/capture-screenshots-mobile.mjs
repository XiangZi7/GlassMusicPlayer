import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const baseUrl = process.env.APP_URL || 'http://localhost:5089/'
console.log("🚀 ~ file: capture-screenshots-mobile.mjs:6 ~ baseUrl:", baseUrl)
const outDir = path.resolve('images', 'mobile')
const routes = [
  { route: '/discover', file: 'image-1.png' },
  { route: '/search?q=绝区零', file: 'image-2.png' },
  { route: '/charts', file: 'image-3.png' },
  { route: '/settings', file: 'image-4.png' },
  { route: '/mv-list', file: 'image-5.png' },
  { route: '/recent', file: 'image-6.png' },
  { route: '/likes', file: 'image-7.png' },
  { route: '/my-music', file: 'image-8.png' },
  { route: '/playlist/3778678', file: 'image-9.png' },
  { route: encodeURI('/artist/周杰伦'), file: 'image-10.png' },
  { route: '/album/18821', file: 'image-11.png' },
  { route: '/song/186016', file: 'image-12.png' },
  { route: '/mv-player/5439102', file: 'image-13.png' },
  { route: '/playlist/19723756', file: 'image-14.png' },
  { route: '/playlist/3779629', file: 'image-15.png' },
  { route: encodeURI('/artist/邓紫棋'), file: 'image-16.png' },
  { route: encodeURI('/artist/林俊杰'), file: 'image-17.png' },
  { route: '/', file: 'image.png' },
]

async function waitForReady(page) {
  try {
    await page.waitForSelector('#nprogress', { hidden: true, timeout: 60000 })
  } catch {}
  try {
    await page.waitForFunction(
      () =>
        document.querySelector('.carousel-container') ||
        document.querySelectorAll('.glass-card').length > 0 ||
        document.querySelector('.absolute-center'),
      { timeout: 15000 }
    )
  } catch {}
  await new Promise((r) => setTimeout(r, 2000))
}

async function capture() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  const ua =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  await page.emulate({
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent: ua,
  })
  for (const item of routes) {
    const url = `${baseUrl}${item.route}`
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForReady(page)
      const outPath = path.join(outDir, item.file)
      await page.screenshot({ path: outPath, fullPage: true })
      console.log(`Saved: ${outPath}`)
    } catch (err) {
      console.error(`Failed: ${url} -> ${item.file}:`, err?.message || err)
    }
  }
  await browser.close()
}

capture()
