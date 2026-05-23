import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PropAccount, AccountStatus } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AccountStatus,
  {
    label: string
    borderColor: string
    badgeClass: string
    countBadgeClass: string
  }
> = {
  active: {
    label: 'Active',
    borderColor: 'border-sky-500',
    badgeClass: 'bg-sky-950 text-sky-400 border border-sky-800',
    countBadgeClass: 'bg-sky-950 text-sky-400',
  },
  passed: {
    label: 'Passed',
    borderColor: 'border-green-500',
    badgeClass: 'bg-green-950 text-green-400 border border-green-800',
    countBadgeClass: 'bg-green-950 text-green-400',
  },
  failed: {
    label: 'Failed',
    borderColor: 'border-red-500',
    badgeClass: 'bg-red-950 text-red-400 border border-red-800',
    countBadgeClass: 'bg-red-950 text-red-400',
  },
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: PropAccount }) {
  const cfg = STATUS_CONFIG[account.status]
  const firm = account.prop_firm_rules

  const balanceUp = account.current_balance >= account.starting_balance

  return (
    <div
      className={`bg-zinc-800 rounded-xl p-5 border-l-4 ${cfg.borderColor}`}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-lg text-white">{account.nickname}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {/* Firm name */}
      {firm && (
        <p className="text-zinc-400 text-sm mb-3">{firm.name}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Starting Balance</p>
          <p className="text-sm font-medium text-white">
            {formatCurrency(account.starting_balance)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Current Balance</p>
          <p
            className={`text-sm font-medium ${
              balanceUp ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {formatCurrency(account.current_balance)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">DLL</p>
          <p className="text-sm font-medium text-white">
            {firm ? formatCurrency(firm.dll_amount) + '/day' : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Profit Target</p>
          <p className="text-sm font-medium text-white">
            {firm ? formatCurrency(firm.profit_target) : '—'}
          </p>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          Created {formatDate(account.created_at)}
        </span>
        <Link
          href="/analytics"
          className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
        >
          View Sessions →
        </Link>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function AccountSection({
  status,
  accounts,
}: {
  status: AccountStatus
  accounts: PropAccount[]
}) {
  const cfg = STATUS_CONFIG[status]

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-white">{cfg.label}</h2>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.countBadgeClass}`}
        >
          {accounts.length}
        </span>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">No {cfg.label.toLowerCase()} accounts.</p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AccountsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: accounts } = await supabase
    .from('prop_accounts')
    .select('*, prop_firm_rules(name, dll_amount, max_drawdown, profit_target)')
    .eq('trader_id', user.id)
    .order('created_at', { ascending: false })

  const allAccounts = (accounts ?? []) as PropAccount[]

  const active = allAccounts.filter((a) => a.status === 'active')
  const passed = allAccounts.filter((a) => a.status === 'passed')
  const failed = allAccounts.filter((a) => a.status === 'failed')

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Prop Accounts</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {allAccounts.length} account{allAccounts.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors"
        >
          + Add Account
        </Link>
      </div>

      {/* Sections */}
      <AccountSection status="active" accounts={active} />
      <AccountSection status="passed" accounts={passed} />
      <AccountSection status="failed" accounts={failed} />
    </div>
  )
}
