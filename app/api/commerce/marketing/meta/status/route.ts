import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/commerce/auth'
import { handleError, ok } from '@/lib/commerce/http'
import {
  META_API_VERSION,
  MetaAdsClient,
  MetaApiError,
  MetaNotConfiguredError,
  isMetaConfigured,
} from '@/lib/commerce/marketing/adapter-meta'
import { describeCampaigns } from '@/lib/commerce/marketing/import'
import { config } from '@/lib/commerce/config'

export const runtime = 'nodejs'

/**
 * GET /api/commerce/marketing/meta/status — admin.
 *
 * A real round trip to the Graph API. Run this before importing or spending:
 * it proves the token, the ad account id, the API version and the permissions
 * in one call, and reports the account currency so a mismatch with
 * COMMERCE_CURRENCY is visible rather than silently corrupting ROAS.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAdmin()

    if (!isMetaConfigured()) {
      return ok({
        configured: false,
        apiVersion: META_API_VERSION,
        requires: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID (campaign creation only)'],
        message:
          'Meta Ads is not configured. Ad spend can still be entered manually in /ops/marketing — those figures are real.',
      })
    }

    const client = new MetaAdsClient()

    try {
      const account = await client.verifyAccess()
      const campaigns = await describeCampaigns()

      return ok({
        configured: true,
        reachable: true,
        apiVersion: META_API_VERSION,
        account,
        currencyMatchesStore: account.currency === config.currency,
        storeCurrency: config.currency,
        canSpend: account.accountStatus === 1,
        campaigns,
        unattributedCampaigns: campaigns.filter((c) => c.attributedBy === 'none').length,
      })
    } catch (err) {
      if (err instanceof MetaApiError) {
        // Reachability failure is a legitimate answer, not a server error —
        // report exactly what Meta said plus what to do about it.
        return ok({
          configured: true,
          reachable: false,
          apiVersion: META_API_VERSION,
          error: err.message,
          code: err.code,
          subcode: err.subcode,
          hint: err.hint,
        })
      }
      throw err
    }
  } catch (err) {
    if (err instanceof MetaNotConfiguredError) {
      return ok({ configured: false, requires: err.requires, message: err.message })
    }
    return handleError(err, 'marketing:meta:status')
  }
}
