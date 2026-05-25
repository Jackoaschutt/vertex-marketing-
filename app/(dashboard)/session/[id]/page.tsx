'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type {
  Session,
  PropAccount,
  PropFirmRule,
  Trade,
  CircuitBreakerEvent,
  CircuitBreakerThreshold,
  SetupType,
} from '@/types'
import { computeSessionPnLState, evaluateCircuitBreaker } from '@/lib/circuit-breaker/engine'
import SessionHeader from '@/components/session/SessionHeader'
import PnlGauge from '@/components/session/PnlGauge'
import TradeList from '@/components/session/TradeList'
import TradeForm from '@/components/session/TradeForm'
import CircuitBreakerModal from '@/components/session/CircuitBreakerModal'
import LockoutScreen from '@/components/session/LockoutScreen'

type AccountWithRules = PropAccount & { prop_firm_rules: PropFirmRule }

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [account, setAccount] = useState<AccountWithRules | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [cbEvents, setCbEvents] = useState<CircuitBreakerEvent[]>([])
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [sessionPnl, setSessionPnl] = useState(0)
  const [triggeredThresholds, setTriggeredThresholds] = useState<Set<CircuitBreakerThreshold>>(
    new Set()
  )
  const [showModal, setShowModal] = useState(false)
  const [showLockout, setShowLockout] = useState(false)
  const [pnlSource, setPnlSource] = useState<'manual' | 'extension'>('manual')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then(({ session: s, trades: t, cbEvents: cb }) => {
        setSession(s)
        if (s?.prop_accounts) {
          setAccount(s.prop_accounts as AccountWithRules)
        }
        setTrades(t ?? [])
        setCbEvents(cb ?? [])

        const thresholds = new Set<CircuitBreakerThreshold>()
        ;(cb ?? []).forEach((event: CircuitBreakerEvent) => {
          thresholds.add(event.threshold_pct)
        })
        setTriggeredThresholds(thresholds)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setSetupTypes([])
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ pnl: number }>
      setPnlSource('extension')
      setSessionPnl(customEvent.detail.pnl)
    }
    window.addEventListener('propguard:pnl', handler as EventListener)
    return () => window.removeEventListener('propguard:pnl', handler as EventListener)
  }, [])

  const manualPnl = trades.reduce((sum, t) => sum + t.pnl, 0)
  const effectivePnl = pnlSource === 'extension' ? sessionPnl : manualPnl

  useEffect(() => {
    if (!account?.prop_firm_rules) return
    const pnlState = computeSessionPnLState(effectivePnl, account.prop_firm_rules.dll_amount)
    const result = evaluateCircuitBreaker(pnlState, triggeredThresholds)

    if (result.shouldFire && result.threshold) {
      setTriggeredThresholds((prev) => new Set(Array.from(prev).concat(result.threshold!)))
      if (result.threshold === 50) setShowModal(true)
      if (result.threshold === 80) setShowLockout(true)
    }
  }, [effectivePnl, account, triggeredThresholds])

  const handleTradeAdded = useCallback((trade: Trade) => {
    setTrades((prev) => [...prev, trade])
  }, [])

  const handleEndSession = useCallback(() => {
    router.push(`/session/${id}/debrief`)
  }, [id, router])

  const handleModalContinue = useCallback(() => {
    setShowModal(false)
  }, [])

  const handleModalEndSession = useCallback(() => {
    setShowModal(false)
    router.push(`/session/${id}/debrief`)
  }, [id, router])

  const handleLockoutEnded = useCallback(() => {
    router.push(`/session/${id}/debrief`)
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !account) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Session not found.</div>
      </div>
    )
  }

  const dllAmount = account.prop_firm_rules?.dll_amount ?? 1000

  return (
    <div className="flex flex-col h-full -m-8">
      <SessionHeader session={session} account={account} onEndSession={handleEndSession} />

      <div className="flex-1 overflow-y-auto p-6">
        {pnlSource === 'extension' && (
          <div className="mb-4 flex items-center gap-2 text-xs text-teal-400 bg-teal-900/20 border border-teal-800/40 rounded-lg px-3 py-2 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            P&L synced from browser extension
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: Gauge */}
          <div className="flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-4">
                Session P&amp;L
              </h2>
              <PnlGauge pnl={effectivePnl} dllAmount={dllAmount} />
            </div>

            {cbEvents.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
                  Circuit Breaker Events
                </h3>
                <div className="flex flex-col gap-2">
                  {cbEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                        ev.threshold_pct === 80
                          ? 'bg-red-900/30 text-red-400 border border-red-800/40'
                          : 'bg-amber-900/30 text-amber-400 border border-amber-800/40'
                      }`}
                    >
                      <span className="font-semibold">{ev.threshold_pct}% DLL Triggered</span>
                      <span className="text-slate-500 font-mono">
                        {new Date(ev.triggered_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Trades */}
          <div className="flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-4">
                Trades
              </h2>
              <TradeList trades={trades} />
            </div>

            <TradeForm
              sessionId={id}
              setupTypes={setupTypes}
              onTradeAdded={handleTradeAdded}
            />
          </div>
        </div>
      </div>

      {showModal && !showLockout && (
        <CircuitBreakerModal
          sessionId={id}
          pnl={effectivePnl}
          dllAmount={dllAmount}
          onContinue={handleModalContinue}
          onEndSession={handleModalEndSession}
        />
      )}

      {showLockout && (
        <LockoutScreen sessionId={id} onSessionEnded={handleLockoutEnded} />
      )}
    </div>
  )
}
