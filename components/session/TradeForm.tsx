'use client'

import { useState } from 'react'
import type { Trade, SetupType, TradeDirection, TradeResult } from '@/types'

interface Props {
  sessionId: string
  setupTypes: SetupType[]
  onTradeAdded: (trade: Trade) => void
}

const EMOTIONAL_STATES = ['Calm', 'Focused', 'Anxious', 'Frustrated', 'Euphoric', 'Greedy']
const CONFLUENCE_OPTIONS = [0, 1, 2, 3, 4, 5]

const initialForm = {
  instrument: '',
  direction: '' as TradeDirection | '',
  result: '' as TradeResult | '',
  pnl: '',
  setup_type_id: '',
  confluence_count: 0,
  emotional_state: '',
  trade_story: '',
}

export default function TradeForm({ sessionId, setupTypes, onTradeAdded }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showStory, setShowStory] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canSubmit =
    form.instrument.trim() !== '' &&
    form.direction !== '' &&
    form.result !== '' &&
    form.pnl !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          instrument: form.instrument.trim(),
          direction: form.direction,
          result: form.result,
          pnl: parseFloat(form.pnl),
          setup_type_id: form.setup_type_id || null,
          confluence_count: form.confluence_count,
          emotional_state: form.emotional_state || null,
          trade_story: form.trade_story || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to log trade')
      }

      const { trade } = await res.json()
      onTradeAdded(trade)
      setForm(initialForm)
      setShowStory(false)
      setExpanded(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-600/50 hover:text-slate-200 hover:bg-teal-950/10 transition-all text-sm font-medium"
      >
        + Log Trade
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Log Trade</h3>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-slate-500 hover:text-slate-200 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Instrument */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Instrument</label>
        <input
          type="text"
          value={form.instrument}
          onChange={(e) => set('instrument', e.target.value)}
          placeholder="NQ, ES, CL..."
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder:text-zinc-600"
        />
      </div>

      {/* Direction */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Direction</label>
        <div className="flex gap-2">
          {(['long', 'short'] as TradeDirection[]).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => set('direction', dir)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors border ${
                form.direction === dir
                  ? dir === 'long'
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : 'bg-red-700 border-red-600 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-zinc-500'
              }`}
            >
              {dir === 'long' ? 'Long' : 'Short'}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Result</label>
        <div className="flex gap-2">
          {(['win', 'loss', 'breakeven'] as TradeResult[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set('result', r)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors border ${
                form.result === r
                  ? r === 'win'
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : r === 'loss'
                    ? 'bg-red-700 border-red-600 text-white'
                    : 'bg-slate-600 border-zinc-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-zinc-500'
              }`}
            >
              {r === 'breakeven' ? 'BE' : r}
            </button>
          ))}
        </div>
      </div>

      {/* P&L */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">P&amp;L ($)</label>
        <input
          type="number"
          step="any"
          value={form.pnl}
          onChange={(e) => set('pnl', e.target.value)}
          placeholder="-250 for a loss, 350 for a win"
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder:text-zinc-600"
        />
      </div>

      {/* Setup type */}
      {setupTypes.length > 0 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Setup Type (optional)</label>
          <select
            value={form.setup_type_id}
            onChange={(e) => set('setup_type_id', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">None</option>
            {setupTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Confluence count */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Confluence Count</label>
        <div className="flex gap-1.5">
          {CONFLUENCE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set('confluence_count', n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors border ${
                form.confluence_count === n
                  ? 'bg-teal-700 border-teal-600 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-zinc-500'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Emotional state */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Emotional State</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOTIONAL_STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => set('emotional_state', form.emotional_state === state ? '' : state)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                form.emotional_state === state
                  ? 'bg-teal-700 border-teal-600 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-zinc-500'
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {/* Trade story toggle */}
      {!showStory ? (
        <button
          type="button"
          onClick={() => setShowStory(true)}
          className="text-xs text-teal-400 hover:text-teal-300 text-left underline"
        >
          + Add trade story
        </button>
      ) : (
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Trade Story (optional)</label>
          <textarea
            value={form.trade_story}
            onChange={(e) => set('trade_story', e.target.value)}
            placeholder="What happened? What were you thinking?"
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder:text-zinc-600 resize-none"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Logging...' : 'Log Trade'}
      </button>
    </form>
  )
}
