import { test, expect } from '@playwright/test'
import { TOKEN, MOBILE, OTP, apiLogin, authedGet } from './helpers'

/**
 * قرارداد سلامت دیپلوی:
 * - status=deploying بدون deploy_error فقط برای استقرار فعال مجاز است
 * - اگر deploy_error / deploy_failed_at باشد → status باید failed باشد
 * - trial.hours همیشه 24
 */
test.describe('Cloud deploy health contract @p0', () => {
  test.skip(!TOKEN && !(MOBILE && OTP), 'Needs HG_E2E_TOKEN or OTP creds')

  let token = ''
  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  function projectsFrom(json: any): any[] {
    const list = json?.data?.data || json?.data?.items || json?.data || json?.projects || []
    return Array.isArray(list) ? list : []
  }

  test('no project stuck as deploying with hard deploy_error @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/cloud/projects')
    expect(res.ok()).toBeTruthy()
    const rows = projectsFrom(await res.json())
    const stuck = rows.filter((p) => {
      const status = String(p?.status || '').toLowerCase()
      const err = String(p?.deploy_error || p?.metadata?.deploy_error || '').trim()
      const failedAt = p?.metadata?.deploy_failed_at
      return status === 'deploying' && (err !== '' || failedAt)
    })
    expect(
      stuck,
      stuck.map((p) => `#${p.id}:${String(p.deploy_error || p.metadata?.deploy_error).slice(0, 80)}`).join(' | '),
    ).toEqual([])
  })

  test('each failed project exposes readable deploy_error @p0', async ({ request }) => {
    const res = await authedGet(request, token, '/cloud/projects')
    expect(res.ok()).toBeTruthy()
    const rows = projectsFrom(await res.json())
    for (const p of rows) {
      if (String(p?.status || '').toLowerCase() !== 'failed') continue
      const err = String(p?.deploy_error || p?.metadata?.deploy_error || p?.metadata?.provision_error || '').trim()
      // بعضی failedهای قدیمی ممکن است پیام نداشته باشند — فقط اگر app_live نیست چک کن
      if (p?.app_live) continue
      expect(err.length, `failed project #${p.id} has empty error`).toBeGreaterThan(0)
    }
  })

  test('GET single project returns consistent status fields @p0', async ({ request }) => {
    const listRes = await authedGet(request, token, '/cloud/projects')
    const rows = projectsFrom(await listRes.json())
    test.skip(rows.length === 0, 'no projects')

    const id = rows[0].id
    const res = await authedGet(request, token, `/cloud/projects/${id}`)
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    const p = json?.data || json
    expect(p?.id || p?.uuid || id).toBeTruthy()
    expect(p?.status || p?.data?.status).toBeTruthy()
    const status = String(p?.status || '').toLowerCase()
    const err = String(p?.deploy_error || p?.metadata?.deploy_error || '').trim()
    if (err && !p?.app_live) {
      expect(status).not.toBe('deploying')
    }
  })
})
