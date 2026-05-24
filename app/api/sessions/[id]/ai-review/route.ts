import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify session ownership and fetch data
  const { data: session } = await supabase
    .from('sessions')
    .select('*, prop_accounts!inner(trader_id, nickname, prop_firm_rules(name, dll_amount, profit_target))')
    .eq('id', id)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const propAccounts = Array.isArray(session.prop_accounts) ? session.prop_accounts[0] : session.prop_accounts
  if ((propAccounts as { trader_id: string } | null)?.trader_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: trades } = await supabase
    .from('trades')
    .select('*, setup_types(name)')
    .eq('session_id', id)
    .order('entry_time')

  const { data: cbEvents } = await supabase
    .from('circuit_breaker_events')
    .select('*')
    .eq('session_id', id)

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI review not configured' }, { status: 503 })
  }

  const client = new Anthropic()

  const tradeList = (trades ?? []).map((t, i) => {
    const setupName = (t.setup_types as { name: string } | null)?.name ?? 'No setup'
    const mistakes = t.mistake_tags?.length > 0 ? ` | Mistakes: ${t.mistake_tags.join(', ')}` : ''
    return `  ${i + 1}. ${t.instrument} ${t.direction.toUpperCase()} — ${t.result.toUpperCase()} — P&L: $${t.pnl.toFixed(2)} — Setup: ${setupName} — Emotion: ${t.emotional_state ?? 'not logged'} — Confluence: ${t.confluence_count}${mistakes}`
  }).join('\n')

  const cbSummary = (cbEvents ?? []).length > 0
    ? `Circuit breaker triggered ${(cbEvents ?? []).length} time(s): ${(cbEvents ?? []).map(e => `${e.threshold_pct}% (${e.action_taken ?? 'no action'})`).join(', ')}`
    : 'No circuit breaker events'

  const sessionPnl = (trades ?? []).reduce((sum, t) => sum + t.pnl, 0)
  const wins = (trades ?? []).filter(t => t.result === 'win').length
  const losses = (trades ?? []).filter(t => t.result === 'loss').length
  const gamePlan = (session as { game_plan?: string }).game_plan ?? null

  const prompt = `You are a professional prop trading coach reviewing a trader's session. Be direct, specific, and constructive. Keep your response concise (200-300 words max).

SESSION OVERVIEW:
- Account: ${(propAccounts as { nickname?: string } | null)?.nickname ?? 'Unknown'}
- Session: ${session.trading_session ?? 'Not specified'}
- Pre-session emotion: ${session.pre_emotional_state ?? 'Not logged'}
- Had a setup plan: ${session.has_setup ? 'Yes' : 'No'}
- Total trades: ${(trades ?? []).length} (${wins}W / ${losses}L)
- Session P&L: $${sessionPnl.toFixed(2)}
- ${cbSummary}

${gamePlan ? `PRE-SESSION GAME PLAN:\n"${gamePlan}"` : 'PRE-SESSION GAME PLAN: Not written (trader skipped this step)'}

TRADES TAKEN:
${tradeList || '  No trades logged'}

Provide a review with these four sections:

**Plan vs Execution**
Did the trader stick to their written game plan? Were the setups aligned with what they planned? Be specific.

**Discipline Assessment**
Rate their discipline (1-10) and explain why. Consider: emotional state, circuit breaker adherence, mistake tags, and consistency.

**Key Pattern**
Identify the single most important pattern you see — positive or negative. This could be about setup selection, emotional control, position sizing, or timing.

**One Actionable Improvement**
Give one specific, actionable thing the trader should change or keep doing in their next session. Be concrete, not generic.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const review = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ review })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI review failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
