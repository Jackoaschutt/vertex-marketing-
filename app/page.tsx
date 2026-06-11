import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const FEATURES = [
  {
    title: 'Circuit Breaker Protection',
    description:
      'Automatic 50% and 80% drawdown alerts force a pause before you blow your daily loss limit — including an unskippable 15-minute lockout at 80%.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    ),
  },
  {
    title: 'Live Session Tracking',
    description:
      'A pre-session checklist, live P&L gauge, and trade logging keep you accountable from the first trade to the debrief.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: 'Trade Journal & Analytics',
    description:
      'Equity curves, win rate by setup, session, and emotional state, plus profit factor — see exactly what is working.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    ),
  },
  {
    title: 'Squad Hub Accountability',
    description:
      'Share every trade with a private squad of fellow traders. Get real-time feedback, emoji reactions, and comments that catch mistakes before they repeat.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 100-8 4 4 0 000 8zm6 1a4 4 0 10-3.87-3M5 8a4 4 0 113.87-3" />
    ),
  },
  {
    title: 'Tradovate Integration',
    description:
      'Connect your Tradovate account or install the Chrome extension for automatic, real-time P&L syncing during live sessions.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-3.75" />
    ),
  },
  {
    title: 'AI Session Review',
    description:
      'Get a personalized debrief after every session — plan vs. execution, discipline rating, and one concrete improvement to focus on next.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    ),
  },
]

const STATS = [
  { value: '$600+', label: 'Average eval fee you risk every reset' },
  { value: '50% / 80%', label: 'Automatic drawdown circuit breakers' },
  { value: '7 days', label: 'Free trial, no credit card required' },
]

const STEPS = [
  {
    step: '01',
    title: 'Connect your account',
    description: 'Link your prop firm rules and Tradovate account in under two minutes.',
  },
  {
    step: '02',
    title: 'Trade with guardrails on',
    description: 'PropGuard tracks your live P&L and forces a pause at 50% and 80% of your daily loss limit.',
  },
  {
    step: '03',
    title: 'Review, journal, improve',
    description: 'Debrief every session, log trades with your Squad, and let AI flag the patterns costing you money.',
  },
]

const PRICING_FEATURES = [
  'Unlimited prop accounts',
  'Circuit breaker protection (50% + 80%)',
  'Full session analytics',
  'Trade journal with emotional tracking',
  'Squad Hub accountability feed',
  'Rule adherence scoring',
  'Tradovate P&L integration (Chrome extension)',
  'AI-powered session reviews',
]

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth="1.5" className="flex-shrink-0">
      {children}
    </svg>
  )
}

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#0b0f1a] overflow-hidden">
      {/* Nav */}
      <header className="border-b border-slate-800/50 relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">PropGuard</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition px-3 py-2">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white rounded-lg px-4 py-2 transition"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        {/* Glow background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-teal-500/10 blur-[120px]" />
          <div className="absolute right-0 top-40 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-teal-300 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
            </span>
            Built for funded futures traders
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight tracking-tight">
            Stop Losing Funded Accounts
            <br />
            <span className="bg-gradient-to-r from-teal-300 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
              to Emotions
            </span>
          </h1>
          <p className="mt-5 text-lg text-slate-400 max-w-2xl mx-auto">
            PropGuard forces you to pause before you blow your daily loss limit — with circuit
            breakers, session accountability, squad-based feedback, and analytics built for prop
            firm traders.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg px-6 py-3 transition shadow-lg shadow-teal-500/20"
            >
              Start Your 7-Day Free Trial
            </Link>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white font-medium rounded-lg px-6 py-3 border border-slate-700 hover:border-slate-600 transition"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">No credit card required to start.</p>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-[#111827]/60 border border-slate-800/50 rounded-2xl px-5 py-4 backdrop-blur">
                <div className="text-2xl font-bold text-teal-400">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1 leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white">How PropGuard works</h2>
          <p className="mt-2 text-slate-400">Three steps between you and your next pass.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div key={s.step} className="relative bg-[#111827] border border-slate-800/50 rounded-2xl p-6">
              <span className="text-5xl font-bold text-teal-500/15 absolute top-4 right-5 select-none">{s.step}</span>
              <h3 className="text-base font-semibold text-white relative">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed relative">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white">Everything you need to stay funded</h2>
          <p className="mt-2 text-slate-400">Discipline tooling built specifically for prop firm evaluations.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-[#111827] border border-slate-800/50 rounded-2xl p-6 hover:border-teal-500/30 transition-colors"
            >
              <Icon>{feature.icon}</Icon>
              <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="relative max-w-6xl mx-auto px-6 pb-24">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-[100px]" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white">Simple Pricing</h2>
          <p className="mt-2 text-slate-400">Less than the cost of one revenge trade.</p>
        </div>

        <div className="bg-[#111827] border border-teal-500/20 rounded-2xl p-8 max-w-md mx-auto flex flex-col gap-6 shadow-xl shadow-teal-500/5">
          <div>
            <div className="text-xl font-bold text-white">PropGuard Pro</div>
            <div className="text-4xl font-bold text-teal-400 mt-2">$19 AUD/mo</div>
            <div className="text-sm text-slate-500 mt-1">
              7-day free trial — no charge until trial ends
            </div>
          </div>

          <ul className="flex flex-col gap-2 text-left">
            {PRICING_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-teal-400 font-bold mt-0.5">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="bg-teal-500 hover:bg-teal-400 transition-colors w-full py-3 text-center text-base font-semibold text-white rounded-lg shadow-lg shadow-teal-500/20"
          >
            Start Free Trial
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Eval fees cost $600+. PropGuard costs $19. Cancel anytime.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-slate-500">
          <span>© {new Date().getFullYear()} PropGuard</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-white transition">Sign In</Link>
            <Link href="/signup" className="hover:text-white transition">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
