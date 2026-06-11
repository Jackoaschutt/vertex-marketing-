import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SquadPost, SquadComment, SquadReaction } from '@/types'
import SquadFeed from './SquadFeed'

export default async function SquadHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: posts } = await supabase
    .from('squad_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const postIds = (posts ?? []).map((p) => p.id)

  const [{ data: comments }, { data: reactions }] = await Promise.all([
    supabase
      .from('squad_comments')
      .select('*')
      .in('post_id', postIds.length > 0 ? postIds : ['__none__'])
      .order('created_at', { ascending: true }),
    supabase
      .from('squad_reactions')
      .select('*')
      .in('post_id', postIds.length > 0 ? postIds : ['__none__']),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Squad Hub</h1>
        <p className="text-slate-500 text-sm mt-1">
          Every trade you log is shared here. Get accountability — let other traders flag mistakes
          and call out patterns before they cost you another account.
        </p>
      </div>

      <SquadFeed
        currentUserId={user.id}
        initialPosts={(posts ?? []) as SquadPost[]}
        initialComments={(comments ?? []) as SquadComment[]}
        initialReactions={(reactions ?? []) as SquadReaction[]}
      />
    </div>
  )
}
