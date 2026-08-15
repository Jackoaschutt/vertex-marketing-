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
  get anthropicConfigured(): boolean {
    return has('ANTHROPIC_API_KEY')
  },
  get cjConfigured(): boolean {
    return has('CJ_EMAIL') && has('CJ_API_KEY')
  },
  get metaConfigured(): boolean {
    return has('META_ACCESS_TOKEN') && has('META_AD_ACCOUNT_ID')
  },
  get serpApiConfigured(): boolean {
    return has('SERPAPI_KEY')
  },
  get cronConfigured(): boolean {
    return has('CRON_SECRET')
  },
  get passcodeConfigured(): boolean {
    return has('ADMIN_PASSCODE')
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
      key: 'ai',
      label: 'AI copy + coach (Anthropic)',
      status: config.anthropicConfigured ? 'REAL' : 'MOCK',
      configured: config.anthropicConfigured,
      requires: ['ANTHROPIC_API_KEY'],
      note: config.anthropicConfigured
        ? `Using ${config.aiModel}.`
        : 'Deterministic fallback generator in use. Output is badged FALLBACK.',
    },
    {
      key: 'supplier_cj',
      label: 'Cost lookup: CJdropshipping',
      status: config.cjConfigured ? 'REAL' : 'TODO',
      configured: config.cjConfigured,
      requires: ['CJ_EMAIL', 'CJ_API_KEY'],
      note: config.cjConfigured
        ? 'Credentials present. Written to CJ published API shapes but never run against a live account — check one price by hand before trusting it.'
        : 'Mock adapter in use. Costs it returns are simulated, never real.',
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
      key: 'research',
      label: 'Demand data (SerpAPI)',
      status: config.serpApiConfigured ? 'REAL' : 'TODO',
      configured: config.serpApiConfigured,
      requires: ['SERPAPI_KEY'],
      note: config.serpApiConfigured
        ? 'Google Trends and Shopping counts are fetched live and stored with their raw payload.'
        : 'No key, so no demand data is collected. The collector returns an error rather than inventing a trend line.',
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
      label: 'Access control',
      status: config.passcodeConfigured ? 'REAL' : 'TODO',
      configured: config.passcodeConfigured,
      requires: ['ADMIN_PASSCODE'],
      note: config.passcodeConfigured
        ? 'One passcode, hashed into a session cookie. Changing it logs every device out.'
        : 'ADMIN_PASSCODE is not set, so the tool is closed to everyone including you.',
    },
  ]
}
