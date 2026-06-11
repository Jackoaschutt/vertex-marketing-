import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/squad/comments — add a comment to a squad post
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_id, body: text } = await req.json()
  if (!post_id || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'post_id and body are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('squad_comments')
    .insert({ post_id, trader_id: user.id, body: text.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ comment: data }, { status: 201 })
}
