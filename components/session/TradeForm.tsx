'use client'

import { useState } from 'react'
import type { Trade, SetupType, TradeDirection, TradeResult } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  sessionId: string
  setupTypes: SetupType[]
  onTradeAdded: (trade: Trade) => void
}

const EMOTIONAL_STATES = ['Calm', 'Focused', 'Anxious', 'Frustrated', 'Euphoric', 'Greedy']
const CONFLUENCE_OPTIONS = [0, 1, 2, 3, 4, 5]

const MISTAKE_TAGS = [
  { label: 'FOMO', color: 'bg-orange-500/15 border-orange-500/30 text-orange-400' },
  { label: 'Revenge Trade', color: 'bg-red-500/15 border-red-500/30 text-red-400' },
  { label: 'Oversized Position', color: 'bg-rose-500/15 border-rose-500/30 text-rose-400' },
  { label: 'Early Entry', color: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
  { label: 'Late Exit', color: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400' },
  { label: 'No Stop Loss', color: 'bg-red-600/15 border-red-600/30 text-red-300' },
  { label: 'Moving Stop', color: 'bg-violet-500/15 border-violet-500/30 text-violet-400' },
  { label: 'Overtrading', color: 'bg-pink-500/15 border-pink-500/30 text-pink-400' },
  { label: 'Ignored CB', color: 'bg-slate-500/15 border-slate-500/30 text-slate-400' },
]

const initialForm = {
  instrument: '',
  direction: '' as TradeDirection | '',
  result: '' as TradeResult | '',
  pnl: '',
  setup_type_id: '',
  confluence_count: 0,
  emotional_state: '',
  trade_story: '',
  mistake_tags: [] as string[],
}

export default function TradeForm({ sessionId, setupTypes, onTradeAdded }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showStory, setShowStory] = useState(false)
  const [showMistakes, setShowMistakes] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${sessionId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('trade-screenshots')
        .upload(path, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('trade-screenshots').getPublicUrl(path)
      setScreenshotUrl(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload screenshot')
    } finally {
      setUploading(false)
    }
  }

  function toggleMistake(label: string) {
    setForm(prev => ({
      ...prev,
      mistake_tags: prev.mistake_tags.includes(label)
        ? prev.mistake_tags.filter(t => t !== label)
        : [...prev.mistake_tags, label],
    }))
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
          mistake_tags: form.mistake_tags,
          screenshot_url: screenshotUrl,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to log trade')
      }

      const { trade } = await res.json()
      onTradeAdded(trade)
      setForm(initialForm)
      setScreenshotUrl(null)
      setShowStory(false)
      setShowMistakes(false)
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

      {/* Mistake tags */}
      {!showMistakes ? (
        <button
          type="button"
          onClick={() => setShowMistakes(true)}
          className="text-xs text-amber-400/70 hover:text-amber-400 text-left"
        >
          + Tag a mistake (optional)
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-400">Mistake Tags</label>
            {form.mistake_tags.length > 0 && (
              <span className="text-xs text-amber-400">{form.mistake_tags.length} tagged</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MISTAKE_TAGS.map(({ label, color }) => {
              const active = form.mistake_tags.includes(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleMistake(label)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    active
                      ? color + ' opacity-100 scale-105'
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {form.mistake_tags.length > 0 && (
            <p className="text-xs text-amber-400/60 mt-2">
              These mistakes will be tracked in your analytics to show their total cost.
            </p>
          )}
        </div>
      )}

      {/* Chart screenshot */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Chart Screenshot (optional)</label>
        {screenshotUrl ? (
          <div className="relative">
            <img src={screenshotUrl} alt="Trade chart" className="w-full max-h-48 object-contain rounded-lg border border-slate-700" />
            <button
              type="button"
              onClick={() => setScreenshotUrl(null)}
              className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center"
            >
              &times;
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center w-full py-3 rounded-lg border border-dashed border-slate-700 text-xs text-slate-400 hover:border-teal-600/50 hover:text-slate-200 cursor-pointer transition-colors">
            {uploading ? 'Uploading...' : '+ Upload chart screenshot'}
            <input type="file" accept="image/*" onChange={handleScreenshotChange} disabled={uploading} className="hidden" />
          </label>
        )}
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
