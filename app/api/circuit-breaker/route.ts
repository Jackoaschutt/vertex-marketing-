import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/circuit-breaker — log a circuit breaker event
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { session_id, threshold_pct, q1_response, q2_response, q3_response, action_taken } = await req.json()

  const { data, error } = await supabase
    .from('circuit_breaker_events')
    .insert({ session_id, threshold_pct, q1_response, q2_response, q3_response, action_taken })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ event: data }, { status: 201 })
}
