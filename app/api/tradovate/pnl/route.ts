import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

// GET /api/tradovate/pnl — attempt Tradovate P&L fetch via live then demo endpoint
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trader } = await supabase
    .from('traders')
    .select('tradovate_username, tradovate_password')
    .eq('id', user.id)
    .single()

  if (!trader?.tradovate_username || !trader?.tradovate_password) {
    return NextResponse.json({ pnl: 0, source: 'unavailable' })
  }

  let password: string
  try {
    password = decrypt(trader.tradovate_password)
  } catch {
    return NextResponse.json({ pnl: 0, source: 'unavailable' })
  }

  const creds = {
    name: trader.tradovate_username,
    password,
    appId: 'PropGuard',
    appVersion: '1.0',
    cid: 0,
    sec: '',
  }

  async function tryEndpoint(base: string): Promise<number | null> {
    const res = await fetch(`${base}/auth/accesstokenrequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    })
    if (!res.ok) return null
    const auth = await res.json()
    if (!auth.accessToken) return null

    const pnlRes = await fetch(`${base}/account/list`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
    if (!pnlRes.ok) return null
    const accounts = await pnlRes.json()
    return accounts?.[0]?.cashBalance ?? 0
  }

  try {
    const livePnl = await tryEndpoint('https://live.tradovateapi.com/v1')
    if (livePnl !== null) return NextResponse.json({ pnl: livePnl, source: 'live' })

    const demoPnl = await tryEndpoint('https://demo.tradovateapi.com/v1')
    if (demoPnl !== null) return NextResponse.json({ pnl: demoPnl, source: 'demo' })
  } catch {
    // Fall through to unavailable
  }

  return NextResponse.json({ pnl: 0, source: 'unavailable' })
}
