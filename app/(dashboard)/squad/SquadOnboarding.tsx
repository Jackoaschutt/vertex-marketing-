'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SquadOnboarding() {
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createSquad() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/squad/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (res.ok) {
      router.refresh()
    } else {
      const body = await res.json()
      setError(body.error ? `${body.error} | code=${body.code} keyPresent=${body.keyPresent} keyRole=${body.keyRole} keyPrefix=${body.keyPrefix}` : 'Something went wrong')
      setLoading(false)
    }
  }

  async function joinSquad() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/squad/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code.trim() }),
    })

    if (res.ok) {
      router.refresh()
    } else {
      const { error: msg } = await res.json()
      setError(msg ?? 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-[#0d1526] to-[#0a1018] border border-slate-800/60 rounded-2xl p-8 max-w-lg mx-auto text-center">
      <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mb-4">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 100-8 4 4 0 000 8zm6 1a4 4 0 10-3.87-3M5 8a4 4 0 113.87-3" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white">You're not in a squad yet</h2>
      <p className="text-slate-500 text-sm mt-1 mb-6">
        Create a private squad and invite your trading buddies, or join one with an invite code.
        Every trade you log gets shared with your squad for accountability.
      </p>

      <div className="flex bg-white/[0.02] border border-slate-800/60 rounded-lg p-1 mb-5">
        <button
          onClick={() => { setMode('create'); setError(null) }}
          className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            mode === 'create' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Create a squad
        </button>
        <button
          onClick={() => { setMode('join'); setError(null) }}
          className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            mode === 'join' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Join with code
        </button>
      </div>

      {mode === 'create' ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createSquad() }}
            placeholder="Squad name, e.g. Apex Grinders"
            maxLength={40}
            className="flex-1 bg-white/[0.02] border border-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/40"
          />
          <button
            onClick={createSquad}
            disabled={loading || !name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            Create
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') joinSquad() }}
            placeholder="Invite code, e.g. 7K3PQM"
            maxLength={6}
            className="flex-1 bg-white/[0.02] border border-slate-800/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 tracking-widest font-mono focus:outline-none focus:border-teal-500/40"
          />
          <button
            onClick={joinSquad}
            disabled={loading || !code.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            Join
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}
