import type { Trade } from '@/types'

interface Props {
  trades: Trade[]
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function TradeList({ trades }: Props) {
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0)
  const sorted = [...trades].reverse()

  const pnlColor = totalPnl >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="flex flex-col gap-3">
      {/* Running total */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Running P&L</span>
        <span className={`text-2xl font-bold font-mono tabular-nums ${pnlColor}`}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
        </span>
      </div>

      {/* Trade rows */}
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No trades yet. Use the form below to log your first trade.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((trade) => {
            const tradePnlColor = trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
            const directionClass =
              trade.direction === 'long'
                ? 'bg-green-900 text-green-400'
                : 'bg-red-900 text-red-400'
            const resultClass =
              trade.result === 'win'
                ? 'bg-green-900/60 text-green-400'
                : trade.result === 'loss'
                ? 'bg-red-900/60 text-red-400'
                : 'bg-slate-700 text-slate-300'
            const pnlStr = `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`

            return (
              <div
                key={trade.id}
                className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2.5"
              >
                {/* Instrument */}
                <span className="font-mono font-bold text-white text-sm w-10 flex-shrink-0">
                  {trade.instrument}
                </span>

                {/* Direction badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${directionClass}`}
                >
                  {trade.direction === 'long' ? 'Long' : 'Short'}
                </span>

                {/* Result badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${resultClass}`}
                >
                  {trade.result === 'breakeven' ? 'BE' : trade.result}
                </span>

                {/* P&L */}
                <span className={`font-mono font-semibold text-sm flex-1 text-right ${tradePnlColor}`}>
                  {pnlStr}
                </span>

                {/* Time */}
                <span className="text-xs text-slate-500 flex-shrink-0 font-mono">
                  {formatTime(trade.entry_time)}
                </span>

                {/* Emotional state chip */}
                {trade.emotional_state && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400 flex-shrink-0">
                    {trade.emotional_state}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
