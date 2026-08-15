import { NextRequest } from 'next/server'
import { sendTemplate } from '@/lib/commerce/email'
import { logEvent } from '@/lib/commerce/db/repo'
import { clientKey, handleError, ok, rateLimit, readJson, tooManyRequests } from '@/lib/commerce/http'
import { Validator } from '@/lib/commerce/validate'
import { brand } from '@/lib/commerce/brand'

export const runtime = 'nodejs'

/** POST /api/commerce/contact — public support form. */
export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(clientKey(request, 'contact'), 5, 600_000)
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds)

    const body = await readJson(request)
    const v = new Validator(body)
    const email = v.email('email', true)
    const subject = v.string('subject', { required: true, min: 2, max: 140 })
    const message = v.string('message', { required: true, min: 10, max: 4000 })
    const honeypot = v.string('company', { max: 200 })
    v.done()

    // Bots fill hidden fields; humans do not. Respond 200 so the bot does not
    // learn it was detected.
    if (honeypot) return ok({ received: true })

    await logEvent({
      kind: 'contact.received',
      message: `Support message from ${email}: ${subject}`,
      data: { email, subject, message },
    })

    const ack = await sendTemplate('support_ack', email, { subject, message })

    return ok({
      received: true,
      acknowledgementSent: ack.sent,
      transport: ack.transport,
      responseWindow: brand.contact.responseWindow,
    })
  } catch (err) {
    return handleError(err, 'contact')
  }
}
