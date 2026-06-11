import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

// GET /api/trader — return trader profile
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('traders').select('*').eq('id', user.id).single()
  return NextResponse.json({ trader: data ? sanitize(data) : data })
}

// PATCH /api/trader — update trader fields
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['timezone', 'tradovate_username', 'tradovate_password']
  const updates: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  if (typeof updates.tradovate_password === 'string') {
    updates.tradovate_password = updates.tradovate_password ? encrypt(updates.tradovate_password) : null
  }

  const { data } = await supabase.from('traders').update(updates).eq('id', user.id).select().single()
  return NextResponse.json({ trader: data ? sanitize(data) : data })
}

// Strip the encrypted credential and replace it with a boolean flag so the
// ciphertext never reaches the browser.
function sanitize(trader: Record<string, unknown>) {
  const { tradovate_password, ...rest } = trader
  return { ...rest, tradovate_connected: !!tradovate_password }
}
