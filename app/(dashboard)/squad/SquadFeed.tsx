'use client'

import { useState } from 'react'
import type { SquadPost, SquadComment, SquadReaction } from '@/types'

const REACTIONS = ['👍', '🔥', '🚩', '🧠', '💀']

function formatPnl(v: number) {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function handleFor(traderId: string, currentUserId: string) {
  if (traderId === currentUserId) return 'You'
  return `Trader #${traderId.slice(0, 6).toUpperCase()}`
}

export default function SquadFeed({
  currentUserId,
  initialPosts,
  initialComments,
  initialReactions,
}: {
  currentUserId: string
  initialPosts: SquadPost[]
  initialComments: SquadComment[]
  initialReactions: SquadReaction[]
}) {
  const [comments, setComments] = useState<SquadComment[]>(initialComments)
  const [reactions, setReactions] = useState<SquadReaction[]>(initialReactions)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  async function toggleReaction(postId: string, emoji: string) {
    const existing = reactions.find(
      (r) => r.post_id === postId && r.trader_id === currentUserId && r.emoji === emoji
    )

    // Optimistic update
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id))
    } else {
      setReactions((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, post_id: postId, trader_id: currentUserId, emoji, created_at: new Date().toISOString() },
      ])
    }

    const res = await fetch('/api/squad/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, emoji }),
    })

    if (!res.ok) {
      // revert on failure
      if (existing) {
        setReactions((prev) => [...prev, existing])
      } else {
        setReactions((prev) => prev.filter((r) => !r.id.startsWith('temp-')))
      }
    }
  }

  async function submitComment(postId: string) {
    const text = (draft[postId] ?? '').trim()
    if (!text) return

    setSubmitting((prev) => ({ ...prev, [postId]: true }))

    const res = await fetch('/api/squad/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, body: text }),
    })

    if (res.ok) {
      const { comment } = await res.json()
      setComments((prev) => [...prev, comment as SquadComment])
      setDraft((prev) => ({ ...prev, [postId]: '' }))
    }

    setSubmitting((prev) => ({ ...prev, [postId]: false }))
  }

  if (initialPosts.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-10 text-center">
        <p className="text-slate-400 text-sm">
          No trades shared yet. Log a trade during a session and it&apos;ll show up here for the squad.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {initialPosts.map((post) => {
        const postComments = comments.filter((c) => c.post_id === post.id)
        const postReactions = reactions.filter((r) => r.post_id === post.id)
        const pnlClass = post.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'

        return (
          <div key={post.id} className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-xs font-bold text-teal-400">
                  {post.trader_id === currentUserId ? 'Y' : '#'}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{handleFor(post.trader_id, currentUserId)}</p>
                  <p className="text-xs text-slate-600">{timeAgo(post.created_at)}</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                  post.direction === 'long'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {post.instrument.toUpperCase()} · {post.direction}
              </span>
            </div>

            {/* P&L + meta */}
            <div className="flex items-center gap-4 mb-3">
              <span className={`text-xl font-bold font-mono ${pnlClass}`}>{formatPnl(post.pnl)}</span>
              <span className="text-xs text-slate-500 capitalize">{post.result}</span>
              {post.confluence_count > 0 && (
                <span className="text-xs text-slate-500">{post.confluence_count} confluence{post.confluence_count !== 1 ? 's' : ''}</span>
              )}
              {post.emotional_state && (
                <span className="text-xs text-slate-500">Felt: {post.emotional_state}</span>
              )}
            </div>

            {/* Mistake tags */}
            {post.mistake_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.mistake_tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Trade story */}
            {post.trade_story && (
              <p className="text-sm text-slate-400 leading-relaxed mb-3 bg-white/[0.02] border border-slate-800/60 rounded-xl px-3 py-2">
                {post.trade_story}
              </p>
            )}

            {/* Reactions */}
            <div className="flex items-center gap-1.5 mb-3">
              {REACTIONS.map((emoji) => {
                const count = postReactions.filter((r) => r.emoji === emoji).length
                const active = postReactions.some((r) => r.emoji === emoji && r.trader_id === currentUserId)
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(post.id, emoji)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors border ${
                      active
                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                        : 'bg-white/[0.02] border-slate-800/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span className="font-mono">{count}</span>}
                  </button>
                )
              })}
            </div>

            {/* Comments */}
            {postComments.length > 0 && (
              <div className="space-y-2 mb-3 border-t border-slate-800/60 pt-3">
                {postComments.map((c) => (
                  <div key={c.id} className="flex gap-2 text-sm">
                    <span className="text-slate-300 font-medium flex-shrink-0">{handleFor(c.trader_id, currentUserId)}:</span>
                    <span className="text-slate-400">{c.body}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={draft[post.id] ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitComment(post.id)
                }}
                placeholder="Spot something? Leave feedback..."
                className="flex-1 bg-white/[0.02] border border-slate-800/60 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/40"
              />
              <button
                onClick={() => submitComment(post.id)}
                disabled={submitting[post.id] || !(draft[post.id] ?? '').trim()}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
