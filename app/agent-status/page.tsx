'use client'

import { useEffect, useState } from 'react'

type EpisodeStatus = 'queued' | 'building' | 'complete' | 'error'

interface Episode {
  id: string
  channel: string
  name: string
  description: string
  status: EpisodeStatus
  agent: string
}

interface BuildStatus {
  episodes: Episode[]
  started_at: string
}

const STATUS_CONFIG: Record<EpisodeStatus, { label: string; color: string; bg: string; glow: string }> = {
  queued:   { label: 'QUEUED',    color: 'text-zinc-500',   bg: 'bg-zinc-800',   glow: '' },
  building: { label: '● LIVE',    color: 'text-green-400',  bg: 'bg-green-950',  glow: 'shadow-[0_0_12px_rgba(74,222,128,0.4)]' },
  complete: { label: '✓ DONE',    color: 'text-sky-400',    bg: 'bg-sky-950',    glow: '' },
  error:    { label: '✗ ERROR',   color: 'text-red-400',    bg: 'bg-red-950',    glow: '' },
}

function ProgressBar({ status }: { status: EpisodeStatus }) {
  const pct = status === 'complete' ? 100 : status === 'building' ? 60 : status === 'error' ? 30 : 5
  const color = status === 'complete' ? 'bg-sky-500' : status === 'building' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-zinc-700'
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${color} ${status === 'building' ? 'animate-pulse' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = Date.now() - new Date(startedAt).getTime()
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${m}m ${s.toString().padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return <span>{elapsed}</span>
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-AU', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono tabular-nums">{time}</span>
}

export default function AgentStatusPage() {
  const [data, setData] = useState<BuildStatus | null>(null)
  const [lastPoll, setLastPoll] = useState(0)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/build-status', { cache: 'no-store' })
        const json = await res.json()
        setData(json)
        setLastPoll(Date.now())
      } catch {}
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [])

  const complete = data?.episodes.filter(e => e.status === 'complete').length ?? 0
  const total = data?.episodes.length ?? 0
  const building = data?.episodes.filter(e => e.status === 'building').length ?? 0

  return (
    <div className="scanlines min-h-screen bg-black text-white font-mono overflow-hidden">
      {/* CRT vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      <div className="relative z-20 max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="border border-zinc-700 bg-zinc-900/80 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📺</div>
              <div>
                <div className="text-lg font-bold tracking-widest text-white uppercase">
                  PropGuard Build TV
                </div>
                <div className="text-xs text-zinc-500 tracking-wider">
                  MULTI-AGENT LIVE BUILD STREAM
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-blink" />
                <span className="text-red-400 font-bold tracking-widest">LIVE</span>
              </div>
              <div className="text-zinc-400"><Clock /></div>
            </div>
          </div>

          {/* Overall progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>
                {building > 0 ? (
                  <span className="text-green-400">{building} agent{building > 1 ? 's' : ''} building</span>
                ) : (
                  <span>build complete</span>
                )}
              </span>
              <span>{complete}/{total} episodes</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-1000"
                style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Episode list */}
        <div className="space-y-2">
          {data ? data.episodes.map((ep) => {
            const cfg = STATUS_CONFIG[ep.status]
            return (
              <div
                key={ep.id}
                className={`border rounded-lg p-3.5 transition-all duration-500 ${cfg.bg} ${
                  ep.status === 'building'
                    ? 'border-green-800 ' + cfg.glow
                    : ep.status === 'complete'
                    ? 'border-sky-900'
                    : 'border-zinc-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Channel number */}
                  <div className="text-xs text-zinc-600 tabular-nums mt-0.5 w-7 shrink-0">
                    CH {ep.channel}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold tracking-wide ${
                          ep.status === 'complete' ? 'text-white' :
                          ep.status === 'building' ? 'text-green-300' :
                          'text-zinc-500'
                        }`}>
                          {ep.name}
                        </span>
                        {ep.status === 'building' && (
                          <span className="text-xs text-zinc-600">{ep.agent}</span>
                        )}
                      </div>
                      <span className={`text-xs font-bold tracking-widest shrink-0 ${cfg.color} ${
                        ep.status === 'building' ? 'animate-pulse' : ''
                      }`}>
                        {cfg.label}
                      </span>
                    </div>

                    <p className={`text-xs mb-2 leading-relaxed ${
                      ep.status === 'complete' ? 'text-zinc-400' :
                      ep.status === 'building' ? 'text-zinc-400' :
                      'text-zinc-600'
                    }`}>
                      {ep.description}
                    </p>

                    <ProgressBar status={ep.status} />
                  </div>
                </div>
              </div>
            )
          }) : (
            // Skeleton
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="border border-zinc-800 rounded-lg p-3.5 animate-pulse bg-zinc-900/50">
                <div className="flex gap-3">
                  <div className="w-7 h-4 bg-zinc-800 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-1/3" />
                    <div className="h-3 bg-zinc-800 rounded w-2/3" />
                    <div className="h-1.5 bg-zinc-800 rounded w-full" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center text-xs text-zinc-700">
          <span>
            {data ? (
              <>build started · <ElapsedTimer startedAt={data.started_at} /> ago</>
            ) : 'connecting...'}
          </span>
          <span>
            {lastPoll > 0 ? `polled ${Math.round((Date.now() - lastPoll) / 1000)}s ago` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
