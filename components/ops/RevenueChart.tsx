'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface Point {
  day: string
  revenueCents: number
  netProfitCents: number
  adSpendCents: number
}

const SERIES = [
  { key: 'revenue', label: 'Revenue', color: '#5c534a' },
  { key: 'profit', label: 'Net profit', color: '#61735a' },
  { key: 'adSpend', label: 'Ad spend', color: '#b7714a' },
] as const

export function RevenueChart({ data, currency = 'USD' }: { data: Point[]; currency?: string }) {
  const rows = data.map((d) => ({
    day: d.day.slice(5),
    revenue: d.revenueCents / 100,
    profit: d.netProfitCents / 100,
    adSpend: d.adSpendCents / 100,
  }))

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n)

  const hasAny = rows.some((r) => r.revenue !== 0 || r.profit !== 0 || r.adSpend !== 0)
  if (!hasAny) {
    return (
      <p className="py-12 text-center text-sm text-ink-500">
        No revenue, profit or ad spend recorded in the last 30 days.
      </p>
    )
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={240}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#e4ddd0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#9a9084' }}
            tickLine={false}
            axisLine={{ stroke: '#e4ddd0' }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9a9084' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
            width={72}
          />
          <Tooltip
            formatter={(value, name) => [fmt(Number(value ?? 0)), String(name ?? '')]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e4ddd0',
              fontSize: 12,
              background: '#fdfcfa',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {SERIES.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              // Entry animation is off: on a dashboard the sweep reads as
              // missing data for the first second, which is worse than useless.
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
