import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/squad/reactions — toggle an emoji reaction on a squad post
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_id, emoji } = await req.json()
  if (!post_id || typeof emoji !== 'string' || !emoji) {
    return NextResponse.json({ error: 'post_id and emoji are required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('squad_reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('trader_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('squad_reactions').delete().eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ active: false })
  }

  const { error } = await supabase
    .from('squad_reactions')
    .insert({ post_id, trader_id: user.id, emoji })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ active: true })
}
