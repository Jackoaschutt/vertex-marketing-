import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInviteCode } from '@/lib/squadCode'

// POST /api/squad/create — create a new private squad and join it as owner
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data: existingMembership } = await supabase
    .from('squad_members')
    .select('squad_id')
    .eq('trader_id', user.id)
    .maybeSingle()

  if (existingMembership) {
    return NextResponse.json({ error: 'You are already in a squad' }, { status: 409 })
  }

  let squad: { id: string; name: string; invite_code: string; owner_id: string; created_at: string } | null = null
  for (let attempt = 0; attempt < 5 && !squad; attempt++) {
    const { data, error } = await supabase
      .from('squads')
      .insert({ name: name.trim(), owner_id: user.id, invite_code: generateInviteCode() })
      .select()
      .single()

    if (data) squad = data
    else if (error && !error.message.includes('invite_code')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (!squad) return NextResponse.json({ error: 'Could not generate invite code, try again' }, { status: 500 })

  const { error: memberError } = await supabase
    .from('squad_members')
    .insert({ squad_id: squad.id, trader_id: user.id })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json({ squad }, { status: 201 })
}
