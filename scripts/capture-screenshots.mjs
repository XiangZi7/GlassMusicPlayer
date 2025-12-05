import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const baseUrl = process.env.APP_URL || 'http://localhost:5089'
const outDir = path.resolve('images')
const t = {
  selector: 4000,
  content: 7000,
  images: 7000,
  networkIdle: 7000,
  idleTime: 300,
  sleep: 200,
}
const routes = [
  { route: '/', file: 'image.png' },
  { route: '/search?q=绝区零', file: 'image-1.png' },
  { route: '/charts', file: 'image-2.png' },
  { route: '/settings', file: 'image-3.png' },
  { route: '/mv-list', file: 'image-4.png' },
  { route: '/recent', file: 'image-5.png' },
  { route: '/likes', file: 'image-6.png' },
  { route: '/my-music', file: 'image-7.png' },
  { route: '/artists', file: 'image-8.png' },
  { route: '/new-albums', file: 'image-9.png' },
  { route: '/playlist/3778678', file: 'image-10.png' },
  { route: '/artist/12138269', file: 'image-11.png' },
  { route: '/album/18821', file: 'image-12.png' },
  { route: '/song/186016', file: 'image-13.png' },
  { route: '/mv-player/5439102', file: 'image-14.png' },
]

async function waitForReady(page) {
  const nprogressExists = await page.$('#nprogress').catch(() => null)
  if (nprogressExists) {
    await page.waitForSelector('#nprogress', { hidden: true, timeout: t.selector }).catch(() => {})
  }

  await page.waitForFunction(
    () => {
      const body = document.body
      const html = document.documentElement
      const hasContent =
        body.scrollHeight > 100 ||
        document.querySelector('.carousel-container') ||
        document.querySelectorAll('.glass-card').length > 0 ||
        document.querySelector('[class*="grid"]') ||
        document.querySelector('[class*="flex"]') ||
        document.querySelector('img[src]') ||
        document.querySelector('video')
      return hasContent
    },
    { timeout: t.content }
  ).catch(() => {})

  await page.waitForFunction(
    () => {
      const images = Array.from(document.querySelectorAll('img[src]'))
      return images.every((img) => img.complete && img.naturalHeight > 0)
    },
    { timeout: t.images }
  ).catch(() => {})

  await page.waitForNetworkIdle({ idleTime: t.idleTime, timeout: t.networkIdle }).catch(() => {})

  await new Promise((r) => setTimeout(r, t.sleep))
}

async function capture() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 })
  await page.setCacheEnabled(true)

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const resourceType = req.resourceType()
    if (['font', 'media'].includes(resourceType)) {
      req.abort()
    } else {
      req.continue()
    }
  })

  const themes = ['light', 'dark']
  for (let i = 0; i < routes.length; i++) {
    const item = routes[i]
    const theme = themes[i % 2]
    const url = `${baseUrl}${item.route}`
    console.log(`Capturing: ${url} (${theme} theme)`)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.evaluate((t) => {
        const globalState = JSON.parse(localStorage.getItem('global') || '{}')
        globalState.theme = t
        localStorage.setItem('global', JSON.stringify(globalState))
        if (t === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }, theme)
      await waitForReady(page)

      const outPath = path.join(outDir, item.file)
      await page.screenshot({ path: outPath, fullPage: false })
      console.log(`Saved: ${outPath}`)
    } catch (err) {
      console.error(`Failed: ${url} -> ${item.file}:`, err?.message || err)
    }
  }

  await browser.close()
  console.log('Done!')
}

capture()
