import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sessions — create a new session
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prop_account_id, trading_session, pre_emotional_state, has_setup } = await req.json()

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
    .single()
  if (existing) return NextResponse.json({ error: 'Active session already exists' }, { status: 409 })

  // Create session
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({ prop_account_id, trading_session, pre_emotional_state, has_setup })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ session }, { status: 201 })
}
