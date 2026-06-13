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
    .select('id, start_time, trading_session, status')
    .eq('prop_account_id', accountId)
    .order('start_time', { ascending: false })
    .limit(1)

  const session = sessions?.[0]
  return NextResponse.json({ session: session?.status === 'active' ? session : null })
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

  // Check for an existing session (any status) on this account
  const { data: existing } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('prop_account_id', prop_account_id)
    .order('start_time', { ascending: false })
    .limit(1)

  const existingSession = existing?.[0]
  if (existingSession?.status === 'active') {
    return NextResponse.json({ error: 'Active session already exists', session: existingSession }, { status: 409 })
  }

  // Create session
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({ prop_account_id, trading_session, pre_emotional_state, has_setup, game_plan })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Active session already exists', session: existingSession ?? null }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session }, { status: 201 })
}
