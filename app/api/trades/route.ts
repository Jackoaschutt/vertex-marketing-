import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/trades — log a new trade
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    session_id,
    instrument,
    direction,
    result,
    pnl,
    setup_type_id,
    confluence_count,
    emotional_state,
    contract_size,
    trade_story,
    mistake_tags,
  } = body

  // Verify session belongs to user (join through prop_accounts)
  const { data: session } = await supabase
    .from('sessions')
    .select('id, prop_accounts!inner(trader_id)')
    .eq('id', session_id)
    .single()

  const propAccount = Array.isArray(session?.prop_accounts) ? session.prop_accounts[0] : session?.prop_accounts
  if (!session || (propAccount as { trader_id: string } | null)?.trader_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: trade, error } = await supabase
    .from('trades')
    .insert({
      session_id,
      instrument,
      direction,
      result,
      pnl,
      setup_type_id,
      confluence_count: confluence_count ?? 0,
      emotional_state,
      contract_size: contract_size ?? 1,
      trade_story,
      mistake_tags: Array.isArray(mistake_tags) ? mistake_tags : [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ trade }, { status: 201 })
}

// PATCH /api/trades — update a trade (id in body)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const allowed = ['instrument', 'direction', 'result', 'pnl', 'setup_type_id', 'confluence_count', 'emotional_state', 'contract_size', 'trade_story', 'mistake_tags']
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))

  const { data, error } = await supabase
    .from('trades')
    .update(filtered)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ trade: data })
}
