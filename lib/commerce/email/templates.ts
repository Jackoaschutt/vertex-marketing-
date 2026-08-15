/**
 * Transactional email templates.
 *
 * Plain, factual, no urgency language, no invented claims. Each template
 * returns a subject plus HTML and text bodies. All interpolated values are
 * HTML-escaped.
 */

import { brand, absoluteUrl, storeUrl } from '../brand'
import { formatMoney } from '../money'
import { escapeHtml } from '../validate'
import type { Fulfillment, Order, OrderItem } from '../types'

export type TemplateId =
  | 'welcome'
  | 'abandoned_cart'
  | 'order_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'post_purchase'
  | 'review_request'
  | 'win_back'
  | 'support_ack'

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const styles = {
  body: 'margin:0;padding:0;background:#f6f4f0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1c1a17;',
  wrap: 'max-width:560px;margin:0 auto;padding:32px 20px;',
  card: 'background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e7e2da;',
  h1: 'margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;',
  p: 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#3d3831;',
  muted: 'margin:24px 0 0;font-size:12px;line-height:1.6;color:#8a8378;',
  cta: 'display:inline-block;margin-top:6px;padding:12px 22px;background:#1c1a17;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:500;',
  row: 'font-size:14px;line-height:1.6;color:#3d3831;padding:6px 0;border-bottom:1px solid #f0ece5;',
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="${styles.body}">
  <div style="${styles.wrap}">
    <div style="font-size:15px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:18px;">${escapeHtml(brand.name)}</div>
    <div style="${styles.card}">
      <h1 style="${styles.h1}">${escapeHtml(heading)}</h1>
      ${bodyHtml}
    </div>
    <p style="${styles.muted}">
      ${escapeHtml(brand.legalName)}<br>
      Questions? Reply to this email or write to ${escapeHtml(brand.contact.supportEmail)}.<br>
      <a href="${absoluteUrl(storeUrl('/pages/privacy'))}" style="color:#8a8378;">Privacy</a> ·
      <a href="${absoluteUrl(storeUrl('/pages/terms'))}" style="color:#8a8378;">Terms</a>
    </p>
  </div>
</body></html>`
}

function itemRows(items: OrderItem[], currency: string): string {
  return items
    .map(
      (i) =>
        `<div style="${styles.row}">${escapeHtml(i.title)} × ${i.quantity} — ${formatMoney(
          i.unit_price_cents * i.quantity,
          currency
        )}</div>`
    )
    .join('')
}

function itemLines(items: OrderItem[], currency: string): string {
  return items
    .map((i) => `- ${i.title} x${i.quantity} — ${formatMoney(i.unit_price_cents * i.quantity, currency)}`)
    .join('\n')
}

export function renderTemplate(
  id: TemplateId,
  ctx: {
    order?: Order
    items?: OrderItem[]
    fulfillment?: Fulfillment
    email?: string
    cartValueCents?: number
    subject?: string
    message?: string
  }
): RenderedEmail {
  const order = ctx.order
  const items = ctx.items ?? []
  const currency = order?.currency ?? 'USD'
  const shopUrl = absoluteUrl(storeUrl('/shop'))

  switch (id) {
    case 'welcome':
      return {
        subject: `Welcome to ${brand.name}`,
        html: layout(
          `Welcome to ${brand.name}`,
          `<p style="${styles.p}">${escapeHtml(brand.promise)}</p>
           <p style="${styles.p}">We email rarely — when something new is genuinely worth your evening, and when your order moves.</p>
           <a href="${shopUrl}" style="${styles.cta}">See what we make</a>`
        ),
        text: `Welcome to ${brand.name}.\n\n${brand.promise}\n\n${shopUrl}`,
      }

    case 'abandoned_cart': {
      const value = ctx.cartValueCents ? formatMoney(ctx.cartValueCents, currency) : ''
      return {
        subject: `You left something in your cart`,
        html: layout(
          'Your cart is still here',
          `<p style="${styles.p}">You had ${value ? `${escapeHtml(value)} of ` : ''}items in your cart. We have kept them for you.</p>
           <p style="${styles.p}">No discount code, no countdown — just the link back.</p>
           <a href="${absoluteUrl(storeUrl('/cart'))}" style="${styles.cta}">Return to cart</a>`
        ),
        text: `Your cart is still here.\n\n${absoluteUrl(storeUrl('/cart'))}`,
      }
    }

    case 'order_confirmation':
      return {
        subject: `Order ${order?.order_number ?? ''} confirmed`,
        html: layout(
          'Order confirmed',
          `<p style="${styles.p}">Thanks — we have your order <strong>${escapeHtml(order?.order_number ?? '')}</strong>.</p>
           ${itemRows(items, currency)}
           <div style="${styles.row}"><strong>Total — ${formatMoney(order?.total_cents ?? 0, currency)}</strong></div>
           <p style="${styles.p}" >It leaves our supplier in ${escapeHtml(brand.shipping.processingDays)}. Typical delivery is ${escapeHtml(brand.shipping.deliveryWindow)}. We will email a tracking number the moment it ships.</p>`
        ),
        text: `Order ${order?.order_number ?? ''} confirmed.\n\n${itemLines(items, currency)}\n\nTotal: ${formatMoney(order?.total_cents ?? 0, currency)}\n\nProcessing: ${brand.shipping.processingDays}. Delivery: ${brand.shipping.deliveryWindow}.`,
      }

    case 'order_shipped': {
      const tracking = ctx.fulfillment?.tracking_number ?? ''
      const url = ctx.fulfillment?.tracking_url ?? ''
      return {
        subject: `Your ${brand.name} order has shipped`,
        html: layout(
          'On its way',
          `<p style="${styles.p}">Order <strong>${escapeHtml(order?.order_number ?? '')}</strong> is on its way.</p>
           ${tracking ? `<p style="${styles.p}">Tracking: <strong>${escapeHtml(tracking)}</strong>${ctx.fulfillment?.carrier ? ` (${escapeHtml(ctx.fulfillment.carrier)})` : ''}</p>` : ''}
           ${url ? `<a href="${escapeHtml(url)}" style="${styles.cta}">Track your parcel</a>` : ''}
           <p style="${styles.p}">Tracking can take a day or two to start updating after dispatch.</p>`
        ),
        text: `Order ${order?.order_number ?? ''} has shipped.\n${tracking ? `Tracking: ${tracking}\n` : ''}${url}`,
      }
    }

    case 'order_delivered':
      return {
        subject: `Your ${brand.name} order was delivered`,
        html: layout(
          'Delivered',
          `<p style="${styles.p}">Tracking shows order <strong>${escapeHtml(order?.order_number ?? '')}</strong> as delivered.</p>
           <p style="${styles.p}">If it has not actually arrived, reply to this email and we will sort it out.</p>`
        ),
        text: `Order ${order?.order_number ?? ''} was delivered. If it hasn't arrived, reply to this email.`,
      }

    case 'post_purchase':
      return {
        subject: `Getting the most out of your order`,
        html: layout(
          'A few notes',
          `<p style="${styles.p}">Your order should have arrived by now. Two things worth knowing:</p>
           <p style="${styles.p}">Give it a week before you judge it — most of what we sell changes an evening routine rather than a single night.</p>
           <p style="${styles.p}">If it is not right, you have ${brand.returns.windowDays} days to return it ${escapeHtml(brand.returns.condition)}.</p>`
        ),
        text: `Your order should have arrived. Returns window: ${brand.returns.windowDays} days, ${brand.returns.condition}.`,
      }

    case 'review_request':
      return {
        subject: `How is it going?`,
        html: layout(
          'Would you tell us how it went?',
          `<p style="${styles.p}">You have had your order for a couple of weeks. If you have two minutes, we would like to know what you actually think — including if it did not work for you.</p>
           <p style="${styles.p}">Just reply to this email. A real person reads it.</p>`
        ),
        text: `How is your order going? Reply to this email — a real person reads it.`,
      }

    case 'win_back':
      return {
        subject: `New at ${brand.name}`,
        html: layout(
          'Since you last visited',
          `<p style="${styles.p}">We have added a few things since your last order. Same rule as always: a short list, each solving one specific problem at the end of the day.</p>
           <a href="${shopUrl}" style="${styles.cta}">See what is new</a>`
        ),
        text: `New at ${brand.name}: ${shopUrl}`,
      }

    case 'support_ack':
      return {
        subject: ctx.subject ? `Re: ${ctx.subject}` : `We got your message`,
        html: layout(
          'We got your message',
          `<p style="${styles.p}">Thanks for writing in. We reply ${escapeHtml(brand.contact.responseWindow)}.</p>
           ${ctx.message ? `<p style="${styles.p}"><em>Your message:</em><br>${escapeHtml(ctx.message).slice(0, 2000)}</p>` : ''}`
        ),
        text: `Thanks for writing in. We reply ${brand.contact.responseWindow}.`,
      }
  }
}
