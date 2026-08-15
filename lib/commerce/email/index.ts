/**
 * Transactional email.
 *
 * Two transports behind one interface:
 *   ConsoleTransport  MOCK — renders and logs the email, records it to
 *                     ds_email_log, sends nothing. Default.
 *   ResendTransport   REAL — activates when RESEND_API_KEY is present.
 *
 * Every send is deduplicated by (order_id, template) so a webhook replay or a
 * repeated automation run cannot email a customer twice.
 */

import { brand } from '../brand'
import { config } from '../config'
import { findEmailLog, recordEmail } from '../db/repo'
import { renderTemplate, type RenderedEmail, type TemplateId } from './templates'
import type { Fulfillment, Order, OrderItem } from '../types'

export interface EmailTransport {
  readonly id: string
  readonly status: 'REAL' | 'MOCK'
  send(to: string, email: RenderedEmail): Promise<{ ok: true } | { ok: false; error: string }>
}

export class ConsoleTransport implements EmailTransport {
  readonly id = 'console'
  readonly status = 'MOCK' as const
  async send(to: string, email: RenderedEmail) {
    console.info(
      `[commerce:email:MOCK] would send to ${to}\n  subject: ${email.subject}\n  ${email.text.replace(/\n/g, '\n  ')}`
    )
    return { ok: true as const }
  }
}

export class ResendTransport implements EmailTransport {
  readonly id = 'resend'
  readonly status = 'REAL' as const

  async send(to: string, email: RenderedEmail) {
    const key = process.env.RESEND_API_KEY
    if (!key) return { ok: false as const, error: 'RESEND_API_KEY is not set.' }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${brand.name} <${brand.contact.fromEmail}>`,
          to: [to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        return { ok: false as const, error: `Resend ${res.status}: ${body.slice(0, 300)}` }
      }
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: `Network error contacting Resend: ${String(err)}` }
    }
  }
}

export function getTransport(): EmailTransport {
  return config.emailConfigured ? new ResendTransport() : new ConsoleTransport()
}

export interface SendResult {
  sent: boolean
  skipped: boolean
  reason?: string
  transport: string
}

export async function sendTemplate(
  id: TemplateId,
  to: string,
  ctx: {
    order?: Order
    items?: OrderItem[]
    fulfillment?: Fulfillment
    cartValueCents?: number
    subject?: string
    message?: string
  } = {}
): Promise<SendResult> {
  const transport = getTransport()

  const orderId = ctx.order?.id ?? null
  if (orderId) {
    const existing = await findEmailLog(orderId, id)
    if (existing) {
      return { sent: false, skipped: true, reason: 'already sent for this order', transport: transport.id }
    }
  }

  const rendered = renderTemplate(id, ctx)
  const result = await transport.send(to, rendered)

  await recordEmail({
    template: id,
    to_email: to,
    subject: rendered.subject,
    order_id: orderId,
    transport: transport.id,
    status: result.ok ? 'sent' : 'failed',
    error: result.ok ? null : result.error,
  })

  if (!result.ok) {
    console.error(`[commerce:email] failed to send ${id} to ${to}: ${result.error}`)
    return { sent: false, skipped: false, reason: result.error, transport: transport.id }
  }
  return { sent: true, skipped: false, transport: transport.id }
}

export { renderTemplate }
export type { TemplateId, RenderedEmail }
