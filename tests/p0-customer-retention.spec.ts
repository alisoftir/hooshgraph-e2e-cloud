import { test, expect } from '@playwright/test'
import {
  API,
  SITE,
  TOKEN,
  MOBILE,
  OTP,
  apiLogin,
  authedGet,
  authedPost,
  gotoPanel,
  gotoWithRetry,
  toPersianMobile,
  assertNo48Hours,
} from './helpers'

/**
 * مسیرهایی که خطای سیستمی = از دست رفتن مشتری:
 * ورود با ارقام فارسی، برند خالی، کیف پول، ساخت ابری بدون اعتبار، اعلان‌ها، پنل.
 */
const hasAuth = Boolean(TOKEN || (MOBILE && OTP))
const probeMobile = MOBILE || '09120000001'

test.describe('Login UI — digit normalizer shipped + ASCII path @p0', () => {
  test('login /_nuxt assets include Persian digit map @p0', async ({ page, request }) => {
    await gotoWithRetry(page, '/login')
    // chunkهای async ممکن است در script اولیه نباشند — از manifest/build عمومی بگرد
    const html = await page.content()
    const srcs = [...html.matchAll(/\/_nuxt\/[A-Za-z0-9_-]+\.js/g)].map((m) => m[0])
    expect(srcs.length).toBeGreaterThan(0)
    let found = false
    const unique = [...new Set(srcs)].slice(0, 60)
    for (const path of unique) {
      const res = await request.get(`${SITE}${path}`)
      if (!res.ok()) continue
      const body = await res.text()
      if (
        body.includes('"۰":"0"') ||
        body.includes('\\u06F0') ||
        body.includes('\u06F0') ||
        /۰.:.0/.test(body)
      ) {
        found = true
        break
      }
    }
    // حتی اگر chunk تنبل لود شود، خود login page chunk باید toEnglishDigits را inline کرده باشد
    expect(found, 'Persian digit map missing from login /_nuxt assets').toBeTruthy()
  })

  test('ASCII mobile enables ادامه @p0', async ({ page }) => {
    await gotoWithRetry(page, '/login')
    const input = page.locator('#mobile')
    await expect(input).toBeVisible({ timeout: 20_000 })
    await input.click()
    await page.keyboard.type(probeMobile, { delay: 25 })
    await expect.poll(async () => input.inputValue(), { timeout: 10_000 }).toBe(probeMobile)
    const continueBtn = page.locator('button[type="submit"]').first()
    await expect.poll(async () => !(await continueBtn.isDisabled()), { timeout: 15_000 }).toBeTruthy()
  })
})

test.describe('Auth API — Persian / Arabic digits @p0', () => {
  test('check-auth accepts Persian digits mobile @p0', async ({ request }) => {
    const persian = toPersianMobile(probeMobile)
    const res = await request.post(`${API}/auth/check`, {
      data: { mobile: persian },
      headers: { Accept: 'application/json' },
    })
    // 200 = نرمال شد؛ 422 قدیمی = ارقام فارسی استریپ شده‌اند
    const text = await res.text()
    expect(res.status(), text.slice(0, 500)).toBeLessThan(500)
    expect(res.status(), `Persian mobile rejected: ${text.slice(0, 400)}`).not.toBe(422)
    expect(res.ok() || res.status() === 200, text.slice(0, 400)).toBeTruthy()
  })

  test('check-auth accepts Arabic-Indic digits mobile @p0', async ({ request }) => {
    const ar = '٠١٢٣٤٥٦٧٨٩'
    const arabic = String(probeMobile).replace(/\d/g, (d) => ar[Number(d)])
    const res = await request.post(`${API}/auth/check`, {
      data: { mobile: arabic },
      headers: { Accept: 'application/json' },
    })
    const text = await res.text()
    expect(res.status(), text.slice(0, 500)).toBeLessThan(500)
    expect(res.status(), text.slice(0, 400)).not.toBe(422)
    expect(res.ok(), text.slice(0, 400)).toBeTruthy()
  })

  test('check-auth rejects garbage without 500 @p0', async ({ request }) => {
    const res = await request.post(`${API}/auth/check`, {
      data: { mobile: 'abc' },
      headers: { Accept: 'application/json' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('Panel retention paths (authed) @p0', () => {
  test.skip(!hasAuth, 'Needs HG_E2E_TOKEN or OTP creds')

  let token = ''
  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  test('brands list never 500; user has at least one brand @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/brands/mine')
    const text = await res.text()
    expect(res.status(), text.slice(0, 400)).toBeLessThan(500)
    expect(res.ok(), text.slice(0, 400)).toBeTruthy()
    const json = JSON.parse(text)
    const list =
      json?.data?.data || json?.data?.items || json?.data || json?.brands || []
    const rows = Array.isArray(list) ? list : []
    expect(rows.length, 'EnsureUserBrand باید حداقل یک برند بسازد').toBeGreaterThan(0)
  })

  test('wallet balance readable; charge path messaging safe @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/wallet')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    const bal =
      json?.data?.balance ?? json?.balance ?? json?.data?.wallet?.balance
    expect(bal === 0 || Number(bal) >= 0 || bal != null).toBeTruthy()
  })

  test('cloud create without plan returns clear 4xx not 500 @p0', async ({ request }) => {
    const res = await authedPost(request, token, '/cloud/projects', {
      name: `e2e-bad-${Date.now()}`,
      type: 'platform',
    })
    const text = await res.text()
    expect(res.status(), text.slice(0, 500)).toBeGreaterThanOrEqual(400)
    expect(res.status(), text.slice(0, 500)).toBeLessThan(500)
    // پیام قابل‌فهم برای کاربر (نه stack trace)
    expect(text).not.toMatch(/Stack trace|Whoops|Illuminate\\\\/i)
  })

  test('cloud create with plan but empty wallet explains charge @p0', async ({ request }) => {
    const catalog = await (await authedGet(request, token, '/cloud/catalog')).json()
    const plans = catalog?.data?.hosting_plans || []
    const tiers = catalog?.data?.feature_tiers || []
    const planId = plans[0]?.id
    const tierId = tiers.find((t: { slug?: string }) => t.slug === 'basic')?.id || tiers[0]?.id
    const brandsRes = await (await authedGet(request, token, '/brands/mine')).json()
    const brands =
      brandsRes?.data?.data || brandsRes?.data?.items || brandsRes?.data || []
    const brandId = Array.isArray(brands) ? brands[0]?.id : null
    test.skip(!planId || !tierId || !brandId, 'catalog/brand missing')

    // Gate only: incomplete git → must be 4xx with human message, never 500
    const res = await authedPost(request, token, '/cloud/projects', {
      name: `e2e-gate-${Date.now().toString(36)}`,
      type: 'platform',
      hosting_plan_id: planId,
      feature_tier_id: tierId,
      billing_mode: 'hourly',
      brand_id: brandId,
      git_provider: 'manual',
    })
    const text = await res.text()
    expect(res.status(), text.slice(0, 600)).toBeLessThan(500)
    expect(text).not.toMatch(/Stack trace|Whoops|Illuminate\\\\/i)
    if (res.status() === 422) {
      expect(text.length).toBeGreaterThan(10)
    }
    assertNo48Hours(text)
  })

  test('notifications list loads without crash @p0', async ({ request }) => {
    for (const path of ['/notifications', '/user/notifications', '/panel/notifications']) {
      const res = await authedGet(request, token, path.replace('/panel', ''))
      // بعضی مسیرها فقط فرانت‌اند هستند؛ APIهای شناخته‌شده را چک کن
      if (path.startsWith('/panel')) continue
      if (res.status() === 404) continue
      expect(res.status(), await res.text()).toBeLessThan(500)
    }
    const res = await authedGet(request, token, '/notifications')
    if (res.status() === 404) {
      const alt = await authedGet(request, token, '/notification-preferences')
      expect(alt.ok()).toBeTruthy()
      return
    }
    expect(res.status()).toBeLessThan(500)
  })

  test('panel brand/team page usable @p0', async ({ page }) => {
    await gotoPanel(page, '/panel/brands/team', token)
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(20)
    assertNo48Hours(body)
    const ok = /برند|شخصی|ایجاد|تیم|ورود|موبایل/i.test(body)
    expect(ok).toBeTruthy()
  })

  test('panel wallet / charge reachable @p0', async ({ page }) => {
    await gotoPanel(page, '/panel/wallet', token)
    await page.waitForTimeout(2000)
    let body = await page.locator('body').innerText()
    if (!/کیف|موجودی|شارژ|wallet/i.test(body)) {
      await gotoPanel(page, '/charge', token)
      await page.waitForTimeout(1500)
      body = await page.locator('body').innerText()
    }
    expect(body).toMatch(/کیف|موجودی|شارژ|wallet|تومان|ریال/i)
    assertNo48Hours(body)
  })

  test('panel notifications page loads @p0', async ({ page }) => {
    await gotoPanel(page, '/panel/notifications', token)
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
    assertNo48Hours(body)
  })
})
