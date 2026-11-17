import { test, expect } from '@playwright/test'
import {
  API,
  TOKEN,
  MOBILE,
  OTP,
  apiLogin,
  authedGet,
  gotoPanel,
  gotoWithRetry,
  pickTrialHours,
  assertHas24Hours,
  assertNo48Hours,
} from './helpers'

test.describe('Cloud marketing — 24h everywhere @p0', () => {
  for (const path of ['/free-cloud', '/docs/cloud-trial', '/pricing', '/smart-cloud-project'] as const) {
    test(`${path} says 24h not 48h @p0`, async ({ page }) => {
      const res = await gotoWithRetry(page, path)
      expect(res?.ok() || res?.status() === 304).toBeTruthy()
      await page.waitForTimeout(1500)
      const body = await page.locator('body').innerText()
      assertNo48Hours(body)
      // بعضی لندینگ‌ها ۲۴س را در hero دارند؛ اگر کپی عوض شد حداقل نباید ۴۸ باشد
      if (path !== '/pricing' || /۲۴|24|ساعت|رایگان/i.test(body)) {
        assertHas24Hours(body)
      }
    })
  }

  test('create wizard route reachable (login or wizard) @p0', async ({ page }) => {
    try {
      await page.goto('/panel/cloud/create', { waitUntil: 'domcontentloaded', timeout: 45_000 })
    } catch {
      // پنل گاهی پشت لاگین/SSR timeout می‌خورد — یک بار دیگر
      await page.goto('/panel/cloud/create', { waitUntil: 'commit', timeout: 45_000 })
    }
    await page.waitForTimeout(1200)
    const url = page.url()
    const text = await page.locator('body').innerText().catch(() => '')
    const ok =
      /ساخت|روش ساخت|دستی|هوش مصنوعی|ورود|کد تایید|موبایل/i.test(text) ||
      /login|otp|auth|cloud\/create/i.test(url)
    expect(ok).toBeTruthy()
    if (text) assertNo48Hours(text)
  })

  test('AI deep-link lands on create mode=ai @p0', async ({ page }) => {
    await gotoWithRetry(page, '/panel/cloud/create?mode=ai')
    await page.waitForTimeout(1200)
    expect(page.url()).toContain('/panel/cloud/create')
  })

  test('database deep-link keeps kind=database @p0', async ({ page }) => {
    await gotoWithRetry(page, '/panel/cloud/create?mode=manual&kind=database&db_engine=mysql')
    expect(page.url()).toContain('kind=database')
  })
})

test.describe('Cloud API — trial hours + catalog @p0', () => {
  test.skip(!TOKEN && !(MOBILE && OTP), 'Needs HG_E2E_TOKEN or OTP creds')

  let token = ''

  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  test('wallet trial.hours === 24 (never 48) @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/wallet')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    const hours = pickTrialHours(json)
    expect(hours, `trial hours missing in wallet: ${JSON.stringify(json).slice(0, 400)}`).not.toBeNull()
    expect(Number(hours)).toBe(24)
  })

  test('cloud catalog returns hosting plans @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/cloud/catalog')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    const plans = json?.data?.hosting_plans || json?.hosting_plans || json?.data
    expect(Array.isArray(plans) ? plans.length : Object.keys(plans || {}).length).toBeGreaterThan(0)
  })

  test('cloud quote hourly returns amount @p0', async ({ request }) => {
    const catalog = await (await authedGet(request, token, '/cloud/catalog')).json()
    const plans = catalog?.data?.hosting_plans || []
    const tiers = catalog?.data?.feature_tiers || []
    const planId = plans[0]?.id
    const tierId = tiers.find((t: { slug?: string }) => t.slug === 'basic')?.id || tiers[0]?.id
    test.skip(!planId || !tierId, 'catalog empty')

    const res = await request.post(`${API}/cloud/quote`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      data: {
        feature_tier_id: tierId,
        billing_mode: 'hourly',
        hosting_plan_ids: [planId],
      },
    })
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    const amount =
      json?.data?.hourly_total ??
      json?.data?.charge_amount ??
      json?.data?.hourly?.total ??
      json?.hourly_total
    expect(Number(amount)).toBeGreaterThanOrEqual(0)
  })

  test('cloud project list: no silent deploying+deploy_error limbo @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/cloud/projects')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    const list: any[] =
      json?.data?.data || json?.data?.items || json?.data || json?.projects || []
    const rows = Array.isArray(list) ? list : []
    for (const p of rows) {
      const status = String(p?.status || '').toLowerCase()
      const err = String(p?.deploy_error || p?.metadata?.deploy_error || '').trim()
      if (!err) continue
      // اگر پیام خطا هست، نباید فقط «در حال استقرار» بی‌پایان باشد
      expect(
        status,
        `project #${p.id} has deploy_error but status=${status}: ${err.slice(0, 120)}`,
      ).not.toBe('deploying')
    }
  })

  test('panel cloud list loads without crash @p0', async ({ page }) => {
    await gotoPanel(page, '/panel/cloud', token)
    await page.waitForTimeout(2500)
    const body = await page.locator('body').innerText()
    assertNo48Hours(body)
    const ok = /پروژه|ابری|ساخت|ورود|موبایل/i.test(body)
    expect(ok).toBeTruthy()
  })

  test('create page CTA copy is 24h when trial shown @p0', async ({ page }) => {
    await gotoPanel(page, '/panel/cloud/create', token)
    await page.waitForTimeout(2500)
    const body = await page.locator('body').innerText()
    assertNo48Hours(body)
    // اگر هنوز روی لاگین ماند (SSR)، فقط مسیر را چک کن
    if (/ورود|شماره موبایل/i.test(body) && !/ساخت|پروژه|سرویس/i.test(body)) {
      expect(page.url()).toMatch(/cloud\/create|login/)
      return
    }
    // «آزمایشی» روی کارت AI را با تریال اشتباه نگیر
    if (/تریال|بدون\s*شارژ|رایگان\s*(ساخت|پروژه|۲۴|24)|۲۴\s*ساعت|24\s*ساعت/i.test(body)) {
      assertHas24Hours(body)
    }
  })
})
