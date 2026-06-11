import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/squad/leave — leave your current squad
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('trader_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
