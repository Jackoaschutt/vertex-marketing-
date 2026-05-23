import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/trader — return trader profile
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('traders').select('*').eq('id', user.id).single()
  return NextResponse.json({ trader: data })
}

// PATCH /api/trader — update trader fields
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['timezone', 'tradovate_username', 'tradovate_password']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { data } = await supabase.from('traders').update(updates).eq('id', user.id).select().single()
  return NextResponse.json({ trader: data })
}
