import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API = process.env.HG_API_BASE || 'https://api.hooshgraph.com/api/v1'
export const SITE = process.env.HG_BASE_URL || 'https://hooshgraph.com'
export const MOBILE = process.env.HG_E2E_MOBILE || ''
export const OTP = process.env.HG_E2E_OTP || ''
export const TOKEN = process.env.HG_E2E_TOKEN || ''

export async function apiLogin(request: APIRequestContext): Promise<string> {
  if (TOKEN) return TOKEN
  if (!MOBILE || !OTP) {
    throw new Error('Set HG_E2E_TOKEN or HG_E2E_MOBILE + HG_E2E_OTP for authenticated tests')
  }
  const res = await request.post(`${API}/auth/otp/verify`, {
    data: { mobile: MOBILE, code: OTP },
  })
  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`OTP login failed ${res.status()}: ${body}`)
  }
  const json = await res.json()
  const token = json?.data?.token || json?.token
  if (!token) throw new Error('No token in OTP response')
  return String(token)
}

export async function authedGet(request: APIRequestContext, token: string, path: string) {
  return request.get(`${API}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
}

export async function authedPost(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
) {
  return request.post(`${API}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    data,
  })
}

export async function gotoPanel(page: Page, path: string, token: string) {
  // پنل هم cookie hg_auth_token و هم localStorage.token می‌خواند
  await page.addInitScript((t) => {
    localStorage.setItem('token', t)
    document.cookie = `hg_auth_token=${encodeURIComponent(t)}; path=/; SameSite=Lax; Secure`
  }, token)
  await page.context().addCookies([
    {
      name: 'hg_auth_token',
      value: token,
      domain: '.hooshgraph.com',
      path: '/',
      secure: true,
      sameSite: 'Lax',
    },
  ])
  await gotoWithRetry(page, path, 4)
}

/**
 * Navigate with retries. Budget is capped so retries don't burn the whole test timeout
 * (historically net::ERR_TIMED_OUT flaked when each attempt used a full 45s).
 */
export async function gotoWithRetry(page: Page, path: string, attempts = 4) {
  let lastErr: unknown
  const modes = ['domcontentloaded', 'commit', 'domcontentloaded', 'commit'] as const
  const perAttempt = Math.min(35_000, Math.floor(80_000 / Math.max(attempts, 1)))
  for (let i = 0; i < attempts; i++) {
    try {
      return await page.goto(path, {
        waitUntil: modes[i] || 'domcontentloaded',
        timeout: perAttempt,
      })
    } catch (e) {
      lastErr = e
      const msg = String((e as Error)?.message || e)
      // Abort remaining retries if the page/test context is already closing
      if (/Target closed|Test ended|browser has been closed/i.test(msg)) break
      await page.waitForTimeout(800 + i * 600).catch(() => {})
    }
  }
  throw lastErr
}

/** Recursively find trial.hours in wallet/cloud JSON */
export function pickTrialHours(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const walk = (node: any, depth = 0): number | null => {
    if (!node || typeof node !== 'object' || depth > 6) return null
    if (typeof node.hours === 'number' && (node.eligible !== undefined || node.min_paid_credit !== undefined || node.title)) {
      return node.hours
    }
    if (node.trial && typeof node.trial === 'object' && typeof node.trial.hours === 'number') {
      return node.trial.hours
    }
    for (const v of Object.values(node)) {
      const found = walk(v, depth + 1)
      if (found !== null) return found
    }
    return null
  }
  return walk(payload)
}

export function assertNo48Hours(text: string) {
  expect(text).not.toMatch(/۴۸\s*ساعت/)
  expect(text).not.toMatch(/48\s*ساعت/)
  expect(text).not.toMatch(/48\s*hours?/i)
}

export function assertHas24Hours(text: string) {
  expect(text).toMatch(/۲۴\s*ساعت|24\s*ساعت|24\s*hours?/i)
}

export async function expectWizardVisible(page: Page) {
  await expect(page.getByRole('heading', { name: /پروژه|ساخت|ابری/i }).first()).toBeVisible({
    timeout: 30_000,
  })
}

/** ۰۹۱۲۰۰۰۰۰۰۱ → 09120000001 */
export function toPersianMobile(ascii: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  return String(ascii).replace(/\d/g, (d) => fa[Number(d)])
}
