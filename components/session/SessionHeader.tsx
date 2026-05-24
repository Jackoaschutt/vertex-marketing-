'use client'

import { useEffect, useState } from 'react'
import type { Session, PropAccount, PropFirmRule } from '@/types'

interface Props {
  session: Session
  account: PropAccount & { prop_firm_rules: PropFirmRule }
  onEndSession: () => void
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

const SESSION_LABELS: Record<string, string> = {
  LONDON: 'LONDON',
  NY_OPEN: 'NY OPEN',
  NY_CLOSE: 'NY CLOSE',
  ASIA: 'ASIA',
  OTHER: 'OTHER',
}

export default function SessionHeader({ session, account, onEndSession }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(session.start_time).getTime()
    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session.start_time])

  const sessionLabel = session.trading_session
    ? SESSION_LABELS[session.trading_session] ?? session.trading_session
    : 'SESSION'

  return (
    <div className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-white">{account.nickname}</span>
        <span className="text-xs text-slate-400">{account.prop_firm_rules?.name ?? 'Custom Rules'}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 rounded-full text-xs font-bold tracking-widest bg-violet-950/70 text-violet-300 border border-violet-700/40">
          {sessionLabel}
        </span>
        <span className="font-mono text-lg text-white tabular-nums">{formatElapsed(elapsed)}</span>
      </div>

      <button
        onClick={onEndSession}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/60 text-red-400 hover:bg-red-800/80 transition-colors border border-red-800/50"
      >
        End Session
      </button>
    </div>
  )
}
