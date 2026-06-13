import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sessions?account_id=xxx — find active session for account
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('account_id')
  if (!accountId) return NextResponse.json({ session: null })

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, start_time, trading_session')
    .eq('prop_account_id', accountId)
    .eq('status', 'active')
    .order('start_time', { ascending: false })
    .limit(1)

  return NextResponse.json({ session: sessions?.[0] ?? null })
}

// POST /api/sessions — create a new session
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prop_account_id, trading_session, pre_emotional_state, has_setup, game_plan } = await req.json()

  const VALID_SESSIONS = ['LONDON', 'NY_OPEN', 'NY_CLOSE', 'ASIA', 'OTHER']
  if (!VALID_SESSIONS.includes(trading_session)) {
    return NextResponse.json({ error: 'Please select a trading session.' }, { status: 400 })
  }

  // Verify prop_account belongs to user
  const { data: account } = await supabase
    .from('prop_accounts')
    .select('id')
    .eq('id', prop_account_id)
    .eq('trader_id', user.id)
    .single()
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Check no active session exists
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('prop_account_id', prop_account_id)
    .eq('status', 'active')
    .limit(1)
  if (existing && existing.length > 0) return NextResponse.json({ error: 'Active session already exists' }, { status: 409 })

  // Create session
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({ prop_account_id, trading_session, pre_emotional_state, has_setup, game_plan })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Active session already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session }, { status: 201 })
}
