import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Squad } from '@/types'

// POST /api/squad/join — join an existing squad via invite code
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invite_code } = await req.json()
  if (typeof invite_code !== 'string' || !invite_code.trim()) {
    return NextResponse.json({ error: 'invite_code is required' }, { status: 400 })
  }

  const db = await createServiceClient()

  const { data: existingMembership } = await db
    .from('squad_members')
    .select('squad_id')
    .eq('trader_id', user.id)
    .maybeSingle()

  if (existingMembership) {
    return NextResponse.json({ error: 'You are already in a squad' }, { status: 409 })
  }

  const { data: squad, error: squadError } = await db
    .from('squads')
    .select('*')
    .eq('invite_code', invite_code.trim().toUpperCase())
    .maybeSingle<Squad>()

  if (squadError) return NextResponse.json({ error: squadError.message }, { status: 500 })
  if (!squad) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })

  const { error: memberError } = await db
    .from('squad_members')
    .insert({ squad_id: squad.id, trader_id: user.id })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json({ squad }, { status: 201 })
}
