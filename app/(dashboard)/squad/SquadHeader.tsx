'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Squad } from '@/types'

export default function SquadHeader({ squad, memberCount }: { squad: Squad; memberCount: number }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(squad.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function leaveSquad() {
    if (!confirm(`Leave ${squad.name}? You'll need an invite code to rejoin.`)) return
    setLeaving(true)
    const res = await fetch('/api/squad/leave', { method: 'POST' })
    if (res.ok) router.refresh()
    else setLeaving(false)
  }

  return (
    <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
      <div>
        <h2 className="text-lg font-bold text-white">{squad.name}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white/[0.02] border border-slate-800/60 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-500">Invite code</span>
          <span className="font-mono font-bold text-teal-400 tracking-widest">{squad.invite_code}</span>
          <button
            onClick={copyCode}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-0.5 rounded border border-slate-700 hover:border-slate-600"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <button
          onClick={leaveSquad}
          disabled={leaving}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
        >
          Leave squad
        </button>
      </div>
    </div>
  )
}
