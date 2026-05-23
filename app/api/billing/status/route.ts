import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/billing/status — return subscription status
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trader } = await supabase
    .from('traders')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    subscription_status: trader?.subscription_status,
    trial_ends_at: trader?.trial_ends_at,
  })
}
