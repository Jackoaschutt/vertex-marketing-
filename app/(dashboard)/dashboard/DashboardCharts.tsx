'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

const BORDER = '#1e1e2e'
const CARD   = '#14141e'
const ACCENT = '#06b6d4'
const SUB    = '#64748b'
const TEXT   = '#f1f5f9'

interface Props {
  equityData:  { day: string; pnl: number }[]
  scoreData:   { date: string; score: number }[]
}

export default function DashboardCharts({ equityData, scoreData }: Props) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '3fr 2fr' }}>
      <div className="bg-[#14141e] border border-[#1e1e2e] rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-4">Equity Curve</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={equityData}>
            <XAxis dataKey="day" tick={{ fill: SUB, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: SUB, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={50} />
            <Tooltip
              contentStyle={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT }}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, 'P&L']}
            />
            <Line type="monotone" dataKey="pnl" stroke={ACCENT} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#14141e] border border-[#1e1e2e] rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-4">Session Scores</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={scoreData} barSize={18}>
            <XAxis dataKey="date" tick={{ fill: SUB, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: SUB, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT }}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]} fill={ACCENT} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
