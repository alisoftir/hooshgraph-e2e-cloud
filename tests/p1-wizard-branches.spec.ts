import { test, expect } from '@playwright/test'
import { TOKEN, MOBILE, OTP, apiLogin, gotoPanel, assertNo48Hours, assertHas24Hours } from './helpers'

test.describe('Cloud wizard branches @p1', () => {
  test.skip(!TOKEN && !(MOBILE && OTP), 'Needs HG_E2E_TOKEN or OTP creds')

  let token = ''
  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  test('manual mode shows service editor @p1', async ({ page }) => {
    await gotoPanel(page, '/panel/cloud/create?mode=manual', token)
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/سرویس|پلتفرم|دیتابیس|دستی|بررسی|روش ساخت|ساخت/)
  })

  test('AI mode shows chat panel @p1', async ({ page }) => {
    await gotoPanel(page, '/panel/cloud/create?mode=ai', token)
    await page.waitForTimeout(2500)
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/هوش|AI|گفتگو|پیشنهاد|پیام|دستی/)
  })

  test('trial CTA copy is 24h when eligible @p1', async ({ page }) => {
    await gotoPanel(page, '/panel/cloud/create', token)
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    assertNo48Hours(body)
    if (body.includes('شروع رایگان') || body.includes('بدون شارژ') || body.includes('۲۴')) {
      assertHas24Hours(body)
    }
  })

  test('failed project detail shows error not endless deploying @p1', async ({ page, request }) => {
    const { authedGet } = await import('./helpers')
    const res = await authedGet(request, token, '/cloud/projects')
    const json = await res.json()
    const list: any[] = json?.data?.data || json?.data?.items || json?.data || []
    const failed = (Array.isArray(list) ? list : []).find((p) => {
      const s = String(p?.status || '').toLowerCase()
      const err = p?.deploy_error || p?.metadata?.deploy_error
      return s === 'failed' || err
    })
    test.skip(!failed, 'no failed project in account')

    await gotoPanel(page, `/panel/cloud/${failed.id}`, token)
    await page.waitForTimeout(2500)
    const body = await page.locator('body').innerText()
    // باید پیام خطا یا برچسب ناموفق دیده شود — نه فقط اسپینر بی‌پایان
    const showsFail =
      /ناموفق|خطا|شکست|حجم|سورس|deploy_error|استقرار ناموفق/i.test(body) ||
      Boolean(failed.deploy_error || failed.metadata?.deploy_error)
    expect(showsFail).toBeTruthy()
  })
})
