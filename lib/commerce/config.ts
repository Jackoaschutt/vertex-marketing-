/**
 * Runtime capability detection.
 *
 * Every integration in this system is optional. This module is the one place
 * that answers "is X actually configured?", so the UI can tell the operator the
 * truth instead of pretending an integration works.
 *
 * Nothing here reads a secret's *value* into client code — these are all
 * server-evaluated booleans.
 */

function has(name: string): boolean {
  const v = process.env[name]
  return typeof v === 'string' && v.trim().length > 0
}

export type IntegrationStatus = 'REAL' | 'MOCK' | 'TODO'

export interface Capability {
  key: string
  label: string
  status: IntegrationStatus
  configured: boolean
  /** What to set to turn this from MOCK into REAL. */
  requires: string[]
  note: string
}

export const config = {
  get databaseConfigured(): boolean {
    return has('NEXT_PUBLIC_SUPABASE_URL') && has('SUPABASE_SERVICE_ROLE_KEY')
  },
  get stripeConfigured(): boolean {
    return has('STRIPE_SECRET_KEY')
  },
  get stripeWebhookConfigured(): boolean {
    return has('STRIPE_COMMERCE_WEBHOOK_SECRET')
  },
  get anthropicConfigured(): boolean {
    return has('ANTHROPIC_API_KEY')
  },
  get emailConfigured(): boolean {
    return has('RESEND_API_KEY')
  },
  get cjConfigured(): boolean {
    return has('CJ_EMAIL') && has('CJ_API_KEY')
  },
  get supplierWebhookConfigured(): boolean {
    return has('SUPPLIER_WEBHOOK_SECRET')
  },
  get metaConfigured(): boolean {
    return has('META_ACCESS_TOKEN') && has('META_AD_ACCOUNT_ID')
  },
  get cronConfigured(): boolean {
    return has('CRON_SECRET')
  },
  get adminEmails(): string[] {
    return (process.env.COMMERCE_ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  },
  get currency(): string {
    return process.env.COMMERCE_CURRENCY ?? 'USD'
  },
  get aiModel(): string {
    return process.env.COMMERCE_AI_MODEL ?? 'claude-opus-5'
  },
  /** True when the app is serving seeded in-memory data rather than a database. */
  get demoMode(): boolean {
    return !this.databaseConfigured
  },
}

export function capabilities(): Capability[] {
  return [
    {
      key: 'database',
      label: 'Database (Supabase Postgres)',
      status: config.databaseConfigured ? 'REAL' : 'MOCK',
      configured: config.databaseConfigured,
      requires: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      note: config.databaseConfigured
        ? 'Persisting to Postgres.'
        : 'DEMO MODE — seeded in-memory data, resets on restart. Nothing is saved.',
    },
    {
      key: 'payments',
      label: 'Payments (Stripe Checkout)',
      status: config.stripeConfigured ? 'REAL' : 'TODO',
      configured: config.stripeConfigured,
      requires: ['STRIPE_SECRET_KEY', 'STRIPE_COMMERCE_WEBHOOK_SECRET'],
      note: config.stripeConfigured
        ? config.stripeWebhookConfigured
          ? 'Checkout and webhook both configured.'
          : 'Checkout works, but the webhook secret is missing — paid orders will not be recorded.'
        : 'Checkout returns a clear error until STRIPE_SECRET_KEY is set.',
    },
    {
      key: 'ai',
      label: 'AI content + analyst (Anthropic)',
      status: config.anthropicConfigured ? 'REAL' : 'MOCK',
      configured: config.anthropicConfigured,
      requires: ['ANTHROPIC_API_KEY'],
      note: config.anthropicConfigured
        ? `Using ${config.aiModel}.`
        : 'Deterministic fallback generator in use. Output is badged FALLBACK.',
    },
    {
      key: 'email',
      label: 'Transactional email (Resend)',
      status: config.emailConfigured ? 'REAL' : 'MOCK',
      configured: config.emailConfigured,
      requires: ['RESEND_API_KEY', 'COMMERCE_FROM_EMAIL'],
      note: config.emailConfigured
        ? 'Emails are delivered.'
        : 'Console transport — emails are rendered and logged, never sent.',
    },
    {
      key: 'supplier_cj',
      label: 'Supplier: CJdropshipping',
      status: config.cjConfigured ? 'REAL' : 'TODO',
      configured: config.cjConfigured,
      requires: ['CJ_EMAIL', 'CJ_API_KEY'],
      note: config.cjConfigured
        ? 'Credentials present. Adapter is written to CJ published API shapes but has NOT been verified against a live account — place a test order before relying on it.'
        : 'Mock supplier adapter in use. Fulfilment is simulated.',
    },
    {
      key: 'supplier_webhook',
      label: 'Supplier webhooks',
      status: config.supplierWebhookConfigured ? 'REAL' : 'TODO',
      configured: config.supplierWebhookConfigured,
      requires: ['SUPPLIER_WEBHOOK_SECRET'],
      note: config.supplierWebhookConfigured
        ? 'Incoming supplier webhooks are HMAC-verified.'
        : 'Endpoint rejects everything until a shared secret is set.',
    },
    {
      key: 'ads',
      label: 'Ad platforms (Meta Marketing API)',
      status: config.metaConfigured ? 'REAL' : 'TODO',
      configured: config.metaConfigured,
      requires: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
      note: config.metaConfigured
        ? 'Meta credentials present. The client is written to the documented Marketing API but has NOT been verified against a live ad account — run the status check in /ops/marketing before trusting the numbers. TikTok and Google Ads are not built; enter their spend manually.'
        : 'The Meta client is written but no credentials are set. TikTok and Google Ads are not built at all. Manual spend entry in /ops/marketing produces real figures either way.',
    },
    {
      key: 'cron',
      label: 'Scheduled automations',
      status: config.cronConfigured ? 'REAL' : 'TODO',
      configured: config.cronConfigured,
      requires: ['CRON_SECRET'],
      note: config.cronConfigured
        ? 'POST /api/commerce/automations/run accepts a bearer token.'
        : 'Automations can still be run manually from /ops/automations.',
    },
    {
      key: 'admin',
      label: 'Admin access control',
      status: config.adminEmails.length > 0 ? 'REAL' : 'TODO',
      configured: config.adminEmails.length > 0,
      requires: ['COMMERCE_ADMIN_EMAILS'],
      note:
        config.adminEmails.length > 0
          ? `${config.adminEmails.length} address(es) allowed.`
          : 'Allowlist is empty, so /ops denies every user. Set COMMERCE_ADMIN_EMAILS.',
    },
  ]
}
