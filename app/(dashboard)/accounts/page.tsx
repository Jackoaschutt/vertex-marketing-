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
    glowClass: string
  }
> = {
  active: {
    label: 'Active',
    borderColor: 'border-teal-500/50',
    badgeClass: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    countBadgeClass: 'bg-teal-500/10 text-teal-400',
    glowClass: 'bg-teal-500/15',
  },
  passed: {
    label: 'Passed',
    borderColor: 'border-emerald-500/50',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    countBadgeClass: 'bg-emerald-500/10 text-emerald-400',
    glowClass: 'bg-emerald-500/15',
  },
  failed: {
    label: 'Failed',
    borderColor: 'border-red-500/50',
    badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20',
    countBadgeClass: 'bg-red-500/10 text-red-400',
    glowClass: 'bg-red-500/15',
  },
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: PropAccount }) {
  const cfg = STATUS_CONFIG[account.status]
  const firm = account.prop_firm_rules

  const balanceUp = account.current_balance >= account.starting_balance

  return (
    <div
      className={`relative bg-gradient-to-br from-[#0d1526] to-[#0a1018] border ${cfg.borderColor} rounded-2xl p-5 overflow-hidden hover:border-teal-500/60 transition-colors`}
    >
      <div className={`absolute -bottom-6 -right-6 w-28 h-28 ${cfg.glowClass} rounded-full blur-2xl pointer-events-none`} />

      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-base text-white">{account.nickname}</span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {firm && (
        <p className="text-slate-500 text-xs mb-4">{firm.name}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-500 mb-0.5">Starting</p>
          <p className="text-sm font-semibold text-white font-mono">
            {formatCurrency(account.starting_balance)}
          </p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-500 mb-0.5">Current</p>
          <p
            className={`text-sm font-semibold font-mono ${
              balanceUp ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatCurrency(account.current_balance)}
          </p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-500 mb-0.5">DLL</p>
          <p className="text-sm font-semibold text-white font-mono">
            {firm ? formatCurrency(firm.dll_amount) : '—'}
          </p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-500 mb-0.5">Target</p>
          <p className="text-sm font-semibold text-white font-mono">
            {firm ? formatCurrency(firm.profit_target) : '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600">
          Created {formatDate(account.created_at)}
        </span>
        <Link
          href="/analytics"
          className="text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium"
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
        <p className="text-sm text-slate-500">No {cfg.label.toLowerCase()} accounts.</p>
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
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Prop Accounts</h1>
          <p className="text-slate-500 text-sm mt-1">
            {allAccounts.length} account{allAccounts.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white transition-colors shadow-lg shadow-teal-500/20"
        >
          + Add Account
        </Link>
      </div>

      <AccountSection status="active" accounts={active} />
      <AccountSection status="passed" accounts={passed} />
      <AccountSection status="failed" accounts={failed} />
    </div>
  )
}
