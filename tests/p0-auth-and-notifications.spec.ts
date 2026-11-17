import { test, expect } from '@playwright/test'
import {
  TOKEN,
  MOBILE,
  OTP,
  apiLogin,
  authedGet,
  gotoPanel,
  gotoWithRetry,
  assertNo48Hours,
} from './helpers'

const hasAuth = Boolean(TOKEN || (MOBILE && OTP))

test.describe('Auth pages (public) @p0', () => {
  test('login page loads @p0', async ({ page }) => {
    await gotoWithRetry(page, '/login')
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/ورود|موبایل|کد|otp|login/i)
  })
})

test.describe('Auth + notification prefs (authed) @p0', () => {
  test.skip(!hasAuth, 'Needs HG_E2E_TOKEN or OTP creds')

  let token = ''
  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  test('wallet endpoint authenticates token @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/wallet')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json?.success !== false).toBeTruthy()
  })

  test('notification preferences API shape @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/notification-preferences')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    const blob = JSON.stringify(json)
    expect(blob).toMatch(/email|sms|channels/i)
  })

  test('panel settings page loads @p0', async ({ page }) => {
    await gotoPanel(page, '/panel/settings', token)
    await page.waitForTimeout(1500)
    const body = await page.locator('body').innerText()
    assertNo48Hours(body)
    expect(body.length).toBeGreaterThan(20)
  })
})

test.describe('Cloud create matrix @p0', () => {
  test.skip(!hasAuth, 'Needs auth')

  let token = ''
  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  for (const [label, path] of [
    ['manual', '/panel/cloud/create?mode=manual'],
    ['ai', '/panel/cloud/create?mode=ai'],
    ['database', '/panel/cloud/create?mode=manual&kind=database&db_engine=mysql'],
    ['oneclick-wp', '/panel/cloud/create?mode=manual&template=wordpress'],
  ] as const) {
    test(`wizard branch ${label} loads @p0`, async ({ page }) => {
      await gotoPanel(page, path, token)
      await page.waitForTimeout(2000)
      const body = await page.locator('body').innerText()
      expect(body).toMatch(/ساخت|پروژه|سرویس|هوش|وردپرس|دیتابیس|پلتفرم|ابری/)
      assertNo48Hours(body)
    })
  }
})
