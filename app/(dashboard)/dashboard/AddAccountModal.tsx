'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PropFirmRule } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  firmOptions: PropFirmRule[]
  userId: string
}

export default function AddAccountModal({
  open,
  onClose,
  firmOptions,
  userId,
}: Props) {
  const router = useRouter()
  const [firmId, setFirmId] = useState('')
  const [nickname, setNickname] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('prop_accounts').insert({
      trader_id: userId,
      firm_id: firmId || null,
      nickname,
      starting_balance: parseFloat(startingBalance),
      current_balance: parseFloat(startingBalance),
      status: 'active',
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setFirmId('')
    setNickname('')
    setStartingBalance('')
    onClose()
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-5">Add Prop Account</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Firm select */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Prop Firm</label>
            <select
              value={firmId}
              onChange={(e) => setFirmId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <option value="">Select a firm</option>
              {firmOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Account Nickname</label>
            <input
              required
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. APEX 50K #1"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 placeholder:text-zinc-500"
            />
          </div>

          {/* Starting balance */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Starting Balance ($)</label>
            <input
              required
              type="number"
              min="1"
              step="any"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="50000"
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 placeholder:text-zinc-500"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-60"
            >
              {loading ? 'Adding…' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
