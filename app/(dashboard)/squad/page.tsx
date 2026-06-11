import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Squad, SquadPost, SquadComment, SquadReaction } from '@/types'
import SquadOnboarding from './SquadOnboarding'
import SquadHeader from './SquadHeader'
import SquadFeed from './SquadFeed'

export default async function SquadHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = await createServiceClient()

  const { data: membership } = await db
    .from('squad_members')
    .select('squad_id')
    .eq('trader_id', user.id)
    .maybeSingle()

  if (!membership) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Squad Hub</h1>
          <p className="text-slate-500 text-sm mt-1">
            Get accountability — share your trades with a small group of traders who can flag
            mistakes and call out patterns before they cost you another account.
          </p>
        </div>
        <SquadOnboarding />
      </div>
    )
  }

  const [{ data: squad }, { count: memberCount }, { data: posts }] = await Promise.all([
    db.from('squads').select('*').eq('id', membership.squad_id).single(),
    db.from('squad_members').select('*', { count: 'exact', head: true }).eq('squad_id', membership.squad_id),
    db
      .from('squad_posts')
      .select('*')
      .eq('squad_id', membership.squad_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const postIds = (posts ?? []).map((p) => p.id)

  const [{ data: comments }, { data: reactions }] = await Promise.all([
    db
      .from('squad_comments')
      .select('*')
      .in('post_id', postIds.length > 0 ? postIds : ['__none__'])
      .order('created_at', { ascending: true }),
    db
      .from('squad_reactions')
      .select('*')
      .in('post_id', postIds.length > 0 ? postIds : ['__none__']),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Squad Hub</h1>
        <p className="text-slate-500 text-sm mt-1">
          Every trade you log is shared with your squad. Get accountability — let them flag
          mistakes and call out patterns before they cost you another account.
        </p>
      </div>

      <SquadHeader squad={squad as Squad} memberCount={memberCount ?? 1} />

      <SquadFeed
        currentUserId={user.id}
        initialPosts={(posts ?? []) as SquadPost[]}
        initialComments={(comments ?? []) as SquadComment[]}
        initialReactions={(reactions ?? []) as SquadReaction[]}
      />
    </div>
  )
}
