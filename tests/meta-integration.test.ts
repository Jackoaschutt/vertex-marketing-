/**
 * Integration test for the Meta client's HTTP layer.
 *
 * The unit tests in meta.test.ts cover the pure transforms. This exercises the
 * parts that only fail against a real server: URL construction, the auth
 * header, cursor paging, the four-step campaign creation sequence, and error
 * translation.
 *
 * It runs against a local mock Graph API rather than Meta, via META_GRAPH_BASE.
 * That is not a stand-in for verifying against a live ad account — it proves
 * the client's own behaviour, not that Meta's field names are what we expect.
 */

import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

interface RecordedRequest {
  method: string
  path: string
  auth: string | undefined
  body: unknown
}

let server: Server
let requests: RecordedRequest[] = []
let scenario: 'ok' | 'expired-version' | 'bad-token' | 'rate-limited' = 'ok'

const ACCOUNT = {
  id: 'act_1234567890',
  name: 'Vesper Test Account',
  currency: 'USD',
  timezone_name: 'America/Los_Angeles',
  account_status: 1,
}

function insightsPage(pageIndex: number, nextUrl: string | null) {
  const day = `2026-08-0${pageIndex + 1}`
  return {
    data: [
      {
        date_start: day,
        date_stop: day,
        campaign_id: `2385100000000000${pageIndex}`,
        campaign_name: `Halo Bedside Light — Aug 2026 [vsp:halo-bedside-light]`,
        impressions: '10000',
        clicks: '200',
        spend: '25.50',
        actions: [
          { action_type: 'link_click', value: '200' },
          { action_type: 'omni_purchase', value: '3' },
          { action_type: 'purchase', value: '3' },
        ],
        action_values: [
          { action_type: 'omni_purchase', value: '147.00' },
          { action_type: 'purchase', value: '147.00' },
        ],
      },
      {
        date_start: day,
        date_stop: day,
        campaign_id: '99999999999999999',
        campaign_name: 'Legacy campaign with no marker',
        impressions: '5000',
        clicks: '40',
        spend: '10.00',
      },
    ],
    paging: nextUrl ? { next: nextUrl } : {},
  }
}

function handler(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString()
    // Use the real Host so paging links this mock hands back are same-origin,
    // exactly as Meta's are.
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    requests.push({
      method: req.method ?? 'GET',
      path: url.pathname,
      auth: req.headers.authorization,
      body: raw ? JSON.parse(raw) : undefined,
    })

    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    }

    if (scenario === 'expired-version') {
      return send(400, {
        error: { message: 'Unsupported get request. Object with ID does not exist', code: 803 },
      })
    }
    if (scenario === 'bad-token') {
      return send(400, { error: { message: 'Error validating access token', code: 190 } })
    }
    if (scenario === 'rate-limited') {
      return send(429, { error: { message: 'User request limit reached', code: 17 } })
    }

    const p = url.pathname

    if (p.endsWith('/act_1234567890') && req.method === 'GET') return send(200, ACCOUNT)

    if (p.endsWith('/insights')) {
      // Page 1 hands back an absolute `next` URL, exactly as Meta does.
      const page = url.searchParams.get('__page')
      if (!page) {
        const next = new URL(url.toString())
        next.searchParams.set('__page', '2')
        return send(200, insightsPage(0, next.toString()))
      }
      return send(200, insightsPage(1, null))
    }

    if (p.endsWith('/campaigns') && req.method === 'GET') {
      return send(200, {
        data: [
          {
            id: 'c-1',
            name: 'Halo — Aug 2026 [vsp:halo-bedside-light]',
            status: 'PAUSED',
            objective: 'OUTCOME_SALES',
            daily_budget: '2000',
          },
          { id: 'c-2', name: 'Unmarked campaign', status: 'ACTIVE', objective: 'OUTCOME_SALES' },
        ],
      })
    }

    if (p.endsWith('/search')) {
      const q = url.searchParams.get('q') ?? ''
      if (q.toLowerCase() === 'nonexistent interest') return send(200, { data: [] })
      return send(200, { data: [{ id: `interest-${q.toLowerCase()}`, name: q }] })
    }

    if (p.endsWith('/campaigns') && req.method === 'POST') return send(200, { id: 'campaign-new' })
    if (p.endsWith('/adsets')) return send(200, { id: 'adset-new' })
    if (p.endsWith('/adcreatives')) return send(200, { id: 'creative-new' })
    if (p.endsWith('/ads')) return send(200, { id: 'ad-new' })

    return send(404, { error: { message: `Mock has no route for ${p}`, code: 100 } })
  })
}

before(async () => {
  server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  process.env.META_GRAPH_BASE = `http://127.0.0.1:${port}`
  process.env.META_ACCESS_TOKEN = 'test-token'
  process.env.META_AD_ACCOUNT_ID = '1234567890' // deliberately without act_
  process.env.META_PAGE_ID = 'page-123'
  process.env.META_API_VERSION = 'v23.0'
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

// The client reads env at call time, so it is required after `before` has run.
async function client() {
  const { MetaAdsClient } = await import('../lib/commerce/marketing/adapter-meta')
  return new MetaAdsClient()
}

test('verifyAccess round-trips and normalises the account id', async () => {
  scenario = 'ok'
  requests = []
  const account = await (await client()).verifyAccess()

  assert.equal(account.name, 'Vesper Test Account')
  assert.equal(account.currency, 'USD')
  assert.equal(account.statusLabel, 'ACTIVE')
  // act_ prefix added even though the env var omitted it.
  assert.match(requests[0].path, /\/v23\.0\/act_1234567890$/)
})

test('the token travels in the Authorization header, never the query string', async () => {
  scenario = 'ok'
  requests = []
  await (await client()).verifyAccess()

  assert.equal(requests[0].auth, 'Bearer test-token')
  // A token in the query string leaks into proxy and server access logs.
  assert.ok(!requests[0].path.includes('test-token'))
})

test('insights paging is followed to the end and rows are mapped', async () => {
  scenario = 'ok'
  requests = []
  const rows = await (await client()).fetchDailyMetrics('2026-08-01', '2026-08-07')

  // Two pages × two rows.
  assert.equal(rows.length, 4)

  const marked = rows.filter((r) => r.productRef === 'halo-bedside-light')
  assert.equal(marked.length, 2)
  assert.equal(marked[0].spendCents, 2550)
  // omni_purchase and purchase both present — must not be summed.
  assert.equal(marked[0].purchases, 3)
  assert.equal(marked[0].revenueCents, 14700)

  const unmarked = rows.filter((r) => r.productRef === null)
  assert.equal(unmarked.length, 2)
  assert.equal(unmarked[0].spendCents, 1000)
  assert.equal(unmarked[0].purchases, 0)

  // The second request followed Meta's absolute paging URL.
  const insightsCalls = requests.filter((r) => r.path.endsWith('/insights'))
  assert.equal(insightsCalls.length, 2)
})

test('a paging link pointing at another origin is refused, not followed', async () => {
  scenario = 'ok'
  const c = await client()
  // Reach into the private follower the same way a malicious paging URL would.
  const follow = (c as unknown as { requestUrl: (u: string) => Promise<unknown> }).requestUrl.bind(c)
  await assert.rejects(
    () => follow('http://169.254.169.254/latest/meta-data/'),
    /Refusing to follow a Meta paging link to a different origin/
  )
})

test('listCampaigns reports the product marker it can see', async () => {
  scenario = 'ok'
  const campaigns = await (await client()).listCampaigns()
  assert.equal(campaigns.length, 2)
  assert.equal(campaigns[0].productSlug, 'halo-bedside-light')
  assert.equal(campaigns[0].dailyBudgetCents, 2000)
  assert.equal(campaigns[1].productSlug, null)
  assert.equal(campaigns[1].dailyBudgetCents, null)
})

test('createCampaign builds all four objects, PAUSED, with resolved interest IDs', async () => {
  scenario = 'ok'
  requests = []
  const result = await (await client()).createCampaign({
    productName: 'Halo Bedside Light',
    productSlug: 'halo-bedside-light',
    destinationUrl: 'https://example.com/store/product/halo-bedside-light',
    dailyBudgetCents: 2000,
    headline: 'Light that does not wake the room',
    body: 'A warm, stepless dimmable bedside light.',
    interests: ['Sleep', 'Nonexistent interest'],
    countries: ['US', 'CA'],
  })

  assert.equal(result.campaignId, 'campaign-new')
  assert.equal(result.adSetId, 'adset-new')
  assert.equal(result.creativeId, 'creative-new')
  assert.equal(result.adId, 'ad-new')
  assert.equal(result.status, 'PAUSED')

  // Interests resolved to IDs; the unmatched one is reported, not sent.
  assert.deepEqual(result.resolvedInterests, [{ name: 'Sleep', id: 'interest-sleep' }])
  assert.deepEqual(result.unresolvedInterests, ['Nonexistent interest'])

  const posts = requests.filter((r) => r.method === 'POST')
  const campaign = posts.find((r) => r.path.endsWith('/campaigns'))!.body as Record<string, unknown>
  const adSet = posts.find((r) => r.path.endsWith('/adsets'))!.body as Record<string, unknown>
  const creative = posts.find((r) => r.path.endsWith('/adcreatives'))!.body as Record<string, unknown>
  const ad = posts.find((r) => r.path.endsWith('/ads'))!.body as Record<string, unknown>

  // Every level paused — an automated system must not start spending by itself.
  assert.equal(campaign.status, 'PAUSED')
  assert.equal(adSet.status, 'PAUSED')
  assert.equal(ad.status, 'PAUSED')

  // The product marker is in the campaign name, so imports attribute correctly.
  assert.match(String(campaign.name), /\[vsp:halo-bedside-light\]/)

  // Budget is sent in minor units, and targeting carries IDs rather than names.
  assert.equal(adSet.daily_budget, 2000)
  const targeting = adSet.targeting as Record<string, unknown>
  assert.deepEqual((targeting.geo_locations as { countries: string[] }).countries, ['US', 'CA'])
  const flexible = targeting.flexible_spec as { interests: { id: string }[] }[]
  assert.equal(flexible[0].interests[0].id, 'interest-sleep')

  // The real page id is used — server.py sent the literal "YOUR_PAGE_ID".
  const story = creative.object_story_spec as { page_id: string }
  assert.equal(story.page_id, 'page-123')
})

test('a budget below the minimum is refused before any request is made', async () => {
  scenario = 'ok'
  requests = []
  const c = await client()
  await assert.rejects(
    () =>
      c.createCampaign({
        productName: 'Halo Bedside Light',
        productSlug: 'halo-bedside-light',
        destinationUrl: 'https://example.com/p',
        dailyBudgetCents: 50, // below Meta's minimum
        headline: 'x',
        body: 'y',
      }),
    /Daily budget must be at least/
  )
  // Nothing was created — the guard runs before the first request, so a bad
  // budget cannot leave a half-built campaign behind.
  assert.equal(requests.length, 0)
})

test('an expired API version surfaces Meta’s message plus an actionable hint', async () => {
  scenario = 'expired-version'
  await assert.rejects(
    async () => (await client()).verifyAccess(),
    (err: Error & { hint?: string }) => {
      assert.match(err.message, /Unsupported get request/)
      assert.match(err.hint ?? '', /META_API_VERSION/)
      return true
    }
  )
})

test('an invalid token is reported as such, not as a generic failure', async () => {
  scenario = 'bad-token'
  await assert.rejects(
    async () => (await client()).verifyAccess(),
    (err: Error & { code?: number; hint?: string }) => {
      assert.equal(err.code, 190)
      assert.match(err.hint ?? '', /token is invalid or expired/)
      return true
    }
  )
})

test('rate limiting is surfaced rather than returning an empty result set', async () => {
  scenario = 'rate-limited'
  await assert.rejects(
    async () => (await client()).fetchDailyMetrics('2026-08-01', '2026-08-02'),
    (err: Error & { status?: number; hint?: string }) => {
      assert.equal(err.status, 429)
      assert.match(err.hint ?? '', /rate limiting/)
      // The important property: a throttled import must NOT look like "no spend
      // today", which would make every ROAS recommendation wrong.
      return true
    }
  )
})
