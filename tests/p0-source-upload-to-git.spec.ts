import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import {
  TOKEN,
  MOBILE,
  OTP,
  API,
  apiLogin,
  authedPost,
} from './helpers'

/**
 * سورس ثابت: fixtures/source-static.zip
 * جریان: upload ZIP → push به Git هوش‌گراف (git.hooshgraph.com)
 */
const hasAuth = Boolean(TOKEN || (MOBILE && OTP))
const zipPath = path.join(__dirname, '../fixtures/source-static.zip')

test.describe('Source upload → Hooshgraph Git @p0', () => {
  test.skip(!hasAuth, 'Needs HG_E2E_TOKEN or OTP creds')
  test.skip(!fs.existsSync(zipPath), `Missing fixture zip: ${zipPath}`)

  let token = ''
  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  test('upload fixture zip and push to git.hooshgraph.com @p0', async ({ request }) => {
    const upload = await request.post(`${API}/cloud/source-upload`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      multipart: {
        archive: {
          name: 'source-static.zip',
          mimeType: 'application/zip',
          buffer: fs.readFileSync(zipPath),
        },
      },
    })
    expect(upload.ok(), await upload.text()).toBeTruthy()
    const upJson = await upload.json()
    const uploadId = upJson?.data?.upload_id
    expect(uploadId, JSON.stringify(upJson).slice(0, 400)).toBeTruthy()

    const projectName = `e2e-fixture-${Date.now().toString(36)}`
    let bodyText = ''
    let toGitOk = false
    for (let i = 0; i < 3; i++) {
      const toGit = await authedPost(request, token, `/cloud/source-upload/${uploadId}/to-git`, {
        project_name: projectName,
      })
      bodyText = await toGit.text()
      if (toGit.ok()) {
        toGitOk = true
        break
      }
      // تایم‌اوت موقت GitLab — کمی صبر و تلاش مجدد با همان upload
      if (!/timed out|cURL error 28/i.test(bodyText)) break
      await new Promise((r) => setTimeout(r, 2000 + i * 2000))
    }
    expect(toGitOk, bodyText.slice(0, 800)).toBeTruthy()
    const gitJson = JSON.parse(bodyText)
    const clone = String(gitJson?.data?.clone_url || gitJson?.clone_url || '')
    const web = String(gitJson?.data?.web_url || gitJson?.web_url || '')
    expect(clone || web).toMatch(/git\.hooshgraph\.com/i)
    expect(clone || web).toBeTruthy()
  })
})
