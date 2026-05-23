'use client'

interface Props {
  pnl: number
  dllAmount: number
}

// Semicircle gauge: sweep from left (180deg) to right (0deg)
// Center at (100, 100), radius 80
const CX = 100
const CY = 100
const R = 80

function polarToCartesian(angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180
  return {
    x: CX + R * Math.cos(rad),
    y: CY + R * Math.sin(rad),
  }
}

function arcPath(startDeg: number, endDeg: number): string {
  const start = polarToCartesian(startDeg)
  const end = polarToCartesian(endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export default function PnlGauge({ pnl, dllAmount }: Props) {
  // Map pnl → angle on the semicircle (0° = left, 180° = right)
  // Neutral (0 pnl) = 90° (top center)
  // -dllAmount = 0° (full left loss), +dllAmount = 180° (full right gain)
  const clamped = Math.max(-dllAmount, Math.min(dllAmount, pnl))
  const fraction = (clamped + dllAmount) / (2 * dllAmount) // 0..1
  const valueAngle = fraction * 180 // 0..180

  const isPositive = pnl >= 0
  const valueColor = isPositive ? '#22c55e' : '#ef4444'

  // Background arc: full semicircle 0→180
  const bgPath = arcPath(0, 180)
  // Value arc: from 90 (center/neutral) toward the value angle
  const valuePath =
    valueAngle >= 90
      ? arcPath(90, valueAngle)
      : arcPath(valueAngle, 90)

  const formatted = `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)}`

  // DLL bar metrics
  const absPct = Math.min((Math.abs(pnl) / dllAmount) * 100, 100)
  const fillColor =
    absPct >= 80
      ? 'bg-red-600'
      : absPct >= 50
      ? 'bg-amber-500'
      : 'bg-green-500'

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SVG Gauge */}
      <svg viewBox="0 0 200 110" className="w-full max-w-xs" style={{ overflow: 'visible' }}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="#3f3f46"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {valueAngle !== 90 && (
          <path
            d={valuePath}
            fill="none"
            stroke={valueColor}
            strokeWidth={14}
            strokeLinecap="round"
          />
        )}
        {/* Center text */}
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          fontSize="22"
          fontWeight="bold"
          fill={valueColor}
          fontFamily="monospace"
        >
          {formatted}
        </text>
        <text
          x={CX}
          y={CY + 26}
          textAnchor="middle"
          fontSize="9"
          fill="#71717a"
          fontFamily="sans-serif"
        >
          Session P&amp;L
        </text>
      </svg>

      {/* DLL Progress Bar */}
      <div className="w-full px-1">
        <div className="relative h-3 w-full bg-zinc-800 rounded-full overflow-visible">
          {/* Fill */}
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${fillColor}`}
            style={{ width: `${absPct}%` }}
          />
          {/* 50% marker */}
          <div
            className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-amber-400/70 rounded"
            style={{ left: '50%' }}
          />
          {/* 80% marker */}
          <div
            className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-red-500/70 rounded"
            style={{ left: '80%' }}
          />
        </div>
        {/* Labels */}
        <div className="relative mt-1 text-[10px] text-zinc-500 select-none" style={{ height: '14px' }}>
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>
            DLL 50%
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: '80%' }}>
            DLL 80%
          </span>
          <span className="absolute right-0">100%</span>
        </div>
      </div>

      {/* Loss vs DLL text */}
      {pnl < 0 && (
        <p className="text-xs text-zinc-400 text-center">
          Loss:{' '}
          <span className="text-red-400 font-mono font-semibold">
            ${Math.abs(pnl).toFixed(2)}
          </span>{' '}
          / DLL:{' '}
          <span className="text-zinc-300 font-mono">${dllAmount.toFixed(2)}</span>{' '}
          <span className="text-zinc-500">({absPct.toFixed(1)}%)</span>
        </p>
      )}
    </div>
  )
}
