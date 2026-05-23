import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sessions/[id] — fetch session with trades and circuit breaker events
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership via join
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, prop_accounts!inner(trader_id)')
    .eq('id', id)
    .single()

  if (error || !session || session.prop_accounts.trader_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [{ data: trades }, { data: cbEvents }] = await Promise.all([
    supabase
      .from('trades')
      .select('*, setup_types(name)')
      .eq('session_id', id)
      .order('entry_time'),
    supabase
      .from('circuit_breaker_events')
      .select('*')
      .eq('session_id', id)
      .order('triggered_at'),
  ])

  return NextResponse.json({ session, trades: trades ?? [], cbEvents: cbEvents ?? [] })
}

// PATCH /api/sessions/[id] — update session (end, debrief, status)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['end_time', 'debrief_responses', 'status']
  const updates: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  if (updates.status === 'completed' && !updates.end_time) {
    updates.end_time = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ session: data })
}
