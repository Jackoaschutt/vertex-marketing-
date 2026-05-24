'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Trader, SetupType, SubscriptionStatus } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'general' | 'setup-types' | 'trading' | 'billing'

interface BillingStatus {
  status: SubscriptionStatus
  trial_ends_at?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIMEZONES = [
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'UTC',
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-4">
      {children}
    </div>
  )
}

function SaveButton({
  onClick,
  loading,
  label = 'Save',
}: {
  onClick: () => void
  loading: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
    >
      {loading ? 'Saving…' : label}
    </button>
  )
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-emerald-400 mt-2">{message}</p>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-400 mt-2">{message}</p>
  )
}

// ─── Tab: General ─────────────────────────────────────────────────────────────

function GeneralTab({ trader }: { trader: Trader }) {
  const [timezone, setTimezone] = useState(trader.timezone ?? 'UTC')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  async function handleSave() {
    setLoading(true)
    setSuccess('')
    setError('')
    try {
      const res = await fetch('/api/trader', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSuccess('Timezone saved successfully.')
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-white mb-4">General Settings</h2>
      <div className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white w-full focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <SaveButton onClick={handleSave} loading={loading} />
        {success && <SuccessMessage message={success} />}
        {error && <ErrorMessage message={error} />}
      </div>
    </SectionCard>
  )
}

// ─── Tab: Setup Types ─────────────────────────────────────────────────────────

function SetupTypesTab({
  traderId,
  initialSetupTypes,
}: {
  traderId: string
  initialSetupTypes: SetupType[]
}) {
  const supabase = createClient()
  const [setupTypes, setSetupTypes] = useState<SetupType[]>(initialSetupTypes)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    const { data } = await supabase
      .from('setup_types')
      .select('*')
      .eq('trader_id', traderId)
      .order('created_at')
    setSetupTypes(data ?? [])
  }

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setAdding(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('setup_types')
        .insert({ trader_id: traderId, name: trimmed })
      if (err) throw err
      setNewName('')
      await refresh()
    } catch {
      setError('Could not add setup type.')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      const { error: err } = await supabase
        .from('setup_types')
        .delete()
        .eq('id', id)
      if (err) throw err
      await refresh()
    } catch {
      setError('Could not delete setup type.')
    }
  }

  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-white mb-4">Setup Types</h2>

      <ul className="space-y-2 mb-4">
        {setupTypes.length === 0 && (
          <li className="text-sm text-zinc-500">No setup types yet.</li>
        )}
        {setupTypes.map((st) => (
          <li
            key={st.id}
            className="flex items-center justify-between bg-zinc-800 border border-zinc-700/50 rounded-lg px-3 py-2"
          >
            <span className="text-sm text-white">{st.name}</span>
            <button
              onClick={() => handleDelete(st.id)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors ml-3"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 max-w-sm">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="e.g. ICT Order Block, FVG, VWAP Pullback"
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white w-full focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm placeholder-zinc-600"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <ErrorMessage message={error} />}
    </SectionCard>
  )
}

// ─── Tab: Trading ─────────────────────────────────────────────────────────────

function TradingTab({ trader }: { trader: Trader }) {
  const [username, setUsername] = useState(trader.tradovate_username ?? '')
  const [password, setPassword] = useState(trader.tradovate_password ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  async function handleSave() {
    setLoading(true)
    setSuccess('')
    setError('')
    try {
      const res = await fetch('/api/trader', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradovate_username: username,
          tradovate_password: password,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSuccess('Credentials saved successfully.')
    } catch {
      setError('Could not save credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <h2 className="text-base font-semibold text-white mb-1">Tradovate Integration</h2>
        <p className="text-sm text-zinc-500 mb-4">Connect your Tradovate account for automatic P&amp;L syncing.</p>

        <div className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Tradovate Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your@email.com"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white w-full focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm placeholder-zinc-600"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Tradovate Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white w-full focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm placeholder-zinc-600 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <SaveButton onClick={handleSave} loading={loading} label="Save Credentials" />
          {success && <SuccessMessage message={success} />}
          {error && <ErrorMessage message={error} />}
        </div>

        <div className="bg-zinc-800 border border-zinc-700/50 rounded-lg p-3 text-sm text-zinc-400 mt-5 max-w-sm">
          Tradovate integration automatically syncs your P&amp;L during live sessions. Your credentials
          are stored securely and only used to fetch P&amp;L data.
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-base font-semibold text-white mb-1">Chrome Extension</h2>
        <p className="text-sm text-zinc-400">
          Install the PropGuard Chrome extension for automatic P&amp;L syncing from Tradovate web.
        </p>
        <a
          href="#"
          className="inline-block mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-2"
        >
          Install Chrome Extension
        </a>
      </SectionCard>
    </div>
  )
}

// ─── Tab: Billing ─────────────────────────────────────────────────────────────

function BillingTab() {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => r.json())
      .then((d) => setBilling(d))
      .catch(() => setError('Could not load billing status.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCheckout() {
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setError('Could not start checkout. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePortal() {
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setError('Could not open billing portal. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <SectionCard>
        <p className="text-sm text-zinc-500">Loading billing status…</p>
      </SectionCard>
    )
  }

  if (error) {
    return (
      <SectionCard>
        <ErrorMessage message={error} />
      </SectionCard>
    )
  }

  const status = billing?.status

  return (
    <SectionCard>
      <h2 className="text-base font-semibold text-white mb-4">Billing</h2>

      {status === 'trialing' && (
        <div className="space-y-4">
          <div className="bg-teal-950 border border-teal-800/40 rounded-lg p-4 text-sm text-teal-300">
            7-day free trial active
            {billing?.trial_ends_at && (
              <> — ends {formatDate(billing.trial_ends_at)}</>
            )}
          </div>
          <button
            onClick={handleCheckout}
            disabled={actionLoading}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {actionLoading ? 'Redirecting…' : 'Upgrade to Pro'}
          </button>
        </div>
      )}

      {status === 'active' && (
        <div className="space-y-4">
          <div className="bg-emerald-950 border border-emerald-800/40 rounded-lg p-4 text-sm text-emerald-300">
            PropGuard Pro — Active
          </div>
          <button
            onClick={handlePortal}
            disabled={actionLoading}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {actionLoading ? 'Redirecting…' : 'Manage Billing'}
          </button>
        </div>
      )}

      {status === 'past_due' && (
        <div className="space-y-4">
          <div className="bg-red-950 border border-red-800/40 rounded-lg p-4 text-sm text-red-300">
            Payment Failed — please update your payment method.
          </div>
          <button
            onClick={handlePortal}
            disabled={actionLoading}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {actionLoading ? 'Redirecting…' : 'Update Payment'}
          </button>
        </div>
      )}

      {status === 'canceled' && (
        <div className="space-y-4">
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-400">
            Subscription canceled.
          </div>
          <button
            onClick={handleCheckout}
            disabled={actionLoading}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {actionLoading ? 'Redirecting…' : 'Resubscribe'}
          </button>
        </div>
      )}

      {!status && (
        <p className="text-sm text-zinc-500">No billing information available.</p>
      )}
    </SectionCard>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'setup-types', label: 'Setup Types' },
  { id: 'trading', label: 'Trading' },
  { id: 'billing', label: 'Billing' },
]

export default function SettingsPage() {
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [trader, setTrader] = useState<Trader | null>(null)
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const [{ data: traderData }, { data: setupTypesData }] = await Promise.all([
        supabase.from('traders').select('*').eq('id', user.id).single(),
        supabase
          .from('setup_types')
          .select('*')
          .eq('trader_id', user.id)
          .order('created_at'),
      ])

      setTrader(traderData)
      setSetupTypes(setupTypesData ?? [])
      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-zinc-500 text-sm">Loading settings…</p>
      </div>
    )
  }

  if (!trader) {
    return (
      <div className="p-8">
        <p className="text-red-400 text-sm">Could not load your profile.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your account preferences and integrations.</p>
      </div>

      <div className="border-b border-zinc-800 mb-6">
        <nav className="flex gap-0">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? 'text-teal-400 border-teal-400'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'general' && <GeneralTab trader={trader} />}
        {activeTab === 'setup-types' && (
          <SetupTypesTab traderId={trader.id} initialSetupTypes={setupTypes} />
        )}
        {activeTab === 'trading' && <TradingTab trader={trader} />}
        {activeTab === 'billing' && <BillingTab />}
      </div>
    </div>
  )
}
