import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { brand } from '@/lib/commerce/brand'
import { formatMoney } from '@/lib/commerce/money'
import { faqJsonLd, jsonLdScript, pageMetadata } from '@/lib/commerce/seo'

export const revalidate = 3600

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string }

interface StaticPage {
  title: string
  intro: string
  blocks: Block[]
  faq?: { question: string; answer: string }[]
}

const LEGAL_PLACEHOLDER =
  'This is a template policy, not legal advice. Replace the bracketed sections and have it reviewed before you take real payments.'

function pages(): Record<string, StaticPage> {
  const s = brand.shipping
  const r = brand.returns

  return {
    about: {
      title: 'About',
      intro: brand.positioning,
      blocks: [
        { type: 'p', text: brand.promise },
        { type: 'h', text: 'How we choose what to sell' },
        {
          type: 'p',
          text: 'Every product is scored before it reaches this site: on the size of the problem it solves, how well it can be demonstrated, how long it takes to arrive, how likely it is to come back, and whether the margin leaves room to run a business honestly. Most candidates do not make it.',
        },
        {
          type: 'list',
          items: [
            'It has to solve one specific problem, not a vague feeling.',
            'It has to survive a fortnight of ordinary use without annoying us.',
            'It has to be describable without exaggeration.',
            'It has to arrive in a time we are willing to print on the page.',
          ],
        },
        { type: 'h', text: 'How we ship' },
        {
          type: 'p',
          text: `We work with fulfilment partners rather than holding stock ourselves. That keeps the range small and the prices sane, and it means delivery takes ${s.deliveryWindow} rather than a day. We say so everywhere it matters instead of burying it.`,
        },
        { type: 'h', text: 'What we will not do' },
        {
          type: 'list',
          items: [
            'Invent reviews, ratings or customer counts.',
            'Show a crossed-out price that was never charged.',
            'Run countdown timers or "only 3 left" banners.',
            'Make a health claim about anything we sell.',
          ],
        },
      ],
    },

    faq: {
      title: 'FAQ',
      intro: 'The questions we actually get asked.',
      blocks: [],
      faq: [
        {
          question: 'How long does delivery take?',
          answer: `Orders leave our supplier in ${s.processingDays}. Typical delivery is ${s.deliveryWindow}, and every order ships with tracking. You will get the tracking number by email on dispatch.`,
        },
        {
          question: 'Where do you ship?',
          answer: s.regions,
        },
        {
          question: 'How much is delivery?',
          answer: `${formatMoney(s.flatRateCents)} flat, free over ${formatMoney(s.freeThresholdCents)}.`,
        },
        {
          question: 'Can I return something?',
          answer: `Yes — within ${r.windowDays} days, ${r.condition}. Return postage is paid by the ${r.whoPaysReturn}. Refunds are issued ${r.refundWindow}.`,
        },
        {
          question: 'Why does delivery take longer than a big retailer?',
          answer: 'Because we do not hold stock in a local warehouse. That is the trade-off that keeps the range small and the prices what they are. If you need something tomorrow, we are not the right shop for that order.',
        },
        {
          question: 'Do you have reviews?',
          answer: 'Not yet. We would rather show none than show invented ones. When we have enough genuine feedback to be useful, it will appear on the product pages.',
        },
        {
          question: 'Is my payment secure?',
          answer: 'Payment is processed by Stripe. Card details go straight to Stripe and are never stored on our servers.',
        },
        {
          question: 'How do I contact you?',
          answer: `Use the contact form or email ${brand.contact.supportEmail}. We reply ${brand.contact.responseWindow}.`,
        },
      ],
    },

    shipping: {
      title: 'Shipping policy',
      intro: `Processing ${s.processingDays}, delivery ${s.deliveryWindow}, tracked.`,
      blocks: [
        { type: 'h', text: 'Processing' },
        { type: 'p', text: `Orders are passed to our fulfilment partner within ${s.processingDays} of payment clearing. Orders placed at a weekend are processed on the next business day.` },
        { type: 'h', text: 'Delivery times' },
        { type: 'p', text: `Typical delivery is ${s.deliveryWindow} after dispatch. Customs handling can add time on international orders and is outside our control.` },
        { type: 'h', text: 'Costs' },
        { type: 'p', text: `Delivery is ${formatMoney(s.flatRateCents)}, or free on orders over ${formatMoney(s.freeThresholdCents)}. Any import duties or taxes are the recipient's responsibility.` },
        { type: 'h', text: 'Where we ship' },
        { type: 'p', text: s.regions },
        { type: 'h', text: 'Tracking' },
        { type: 'p', text: 'Every order ships with a tracking number, emailed on dispatch. Tracking can take a day or two to start updating after the carrier scans the parcel.' },
        { type: 'h', text: 'Lost or delayed parcels' },
        { type: 'p', text: `If tracking has not moved for 10 business days, contact us at ${brand.contact.supportEmail} and we will open a case with the carrier.` },
        { type: 'note', text: LEGAL_PLACEHOLDER },
      ],
    },

    returns: {
      title: 'Returns & refunds',
      intro: `${r.windowDays} days, ${r.condition}.`,
      blocks: [
        { type: 'h', text: 'Return window' },
        { type: 'p', text: `You may return an item within ${r.windowDays} days of delivery provided it is ${r.condition}.` },
        { type: 'h', text: 'How to start a return' },
        { type: 'p', text: `Email ${brand.contact.supportEmail} with your order number and what you would like to return. We will reply ${brand.contact.responseWindow} with the return address and instructions. Do not send anything back before you have that address.` },
        { type: 'h', text: 'Return postage' },
        { type: 'p', text: `Return postage is paid by the ${r.whoPaysReturn}, except where the item arrived damaged, faulty, or is not what was ordered — in those cases we cover it.` },
        { type: 'h', text: 'Refunds' },
        { type: 'p', text: `Refunds are issued to the original payment method ${r.refundWindow}. Original delivery charges are refunded only where the item was faulty or incorrect.` },
        { type: 'h', text: 'Damaged or incorrect items' },
        { type: 'p', text: 'Send a photo with your order number within 7 days of delivery and we will replace it or refund it — your choice.' },
        { type: 'note', text: `${LEGAL_PLACEHOLDER} Statutory rights (for example distance-selling and consumer-rights legislation in your jurisdiction) apply in addition to this policy and are not affected by it.` },
      ],
    },

    privacy: {
      title: 'Privacy policy',
      intro: 'What we collect, why, and what we do not do with it.',
      blocks: [
        { type: 'h', text: 'Who we are' },
        { type: 'p', text: `${brand.legalName}, ${brand.contact.addressLines.join(', ')}. Contact: ${brand.contact.supportEmail}.` },
        { type: 'h', text: 'What we collect' },
        {
          type: 'list',
          items: [
            'Order information: name, email, delivery address, and what you ordered.',
            'Payment information: handled entirely by Stripe. We receive a confirmation and the last four digits, never the full card number.',
            'Marketing attribution: the source that referred your visit, stored in a first-party cookie for 30 days.',
            'Support correspondence you send us.',
          ],
        },
        { type: 'h', text: 'Why we collect it' },
        { type: 'p', text: 'To take payment, ship your order, answer your questions, and understand which marketing is working. We do not sell personal data.' },
        { type: 'h', text: 'Who we share it with' },
        { type: 'p', text: 'Our payment processor (Stripe), our fulfilment partners (to ship your order), and our email provider (to send order updates). Each receives only what it needs to do its job.' },
        { type: 'h', text: 'Cookies' },
        { type: 'p', text: 'We use a first-party cookie to remember which marketing source referred you, and browser storage to remember your cart. We do not use third-party advertising cookies on this site.' },
        { type: 'h', text: 'Your rights' },
        { type: 'p', text: `You can ask for a copy of your data, ask us to correct it, or ask us to delete it. Email ${brand.contact.supportEmail} and we will respond within 30 days. [Add the specific rights and supervisory-authority details for your jurisdiction.]` },
        { type: 'h', text: 'Retention' },
        { type: 'p', text: 'Order records are kept for as long as required for accounting and tax purposes. [Insert your retention period.]' },
        { type: 'note', text: LEGAL_PLACEHOLDER },
      ],
    },

    terms: {
      title: 'Terms of service',
      intro: 'The agreement between you and us when you buy something here.',
      blocks: [
        { type: 'h', text: 'These terms' },
        { type: 'p', text: `By placing an order with ${brand.legalName} you agree to these terms.` },
        { type: 'h', text: 'Orders' },
        { type: 'p', text: 'An order is an offer to buy. It is accepted when we send the confirmation email. We may decline an order — for example where an item is unavailable or a price was displayed incorrectly — and will refund you in full if we do.' },
        { type: 'h', text: 'Pricing' },
        { type: 'p', text: 'Prices are shown in the currency displayed at checkout and include applicable sales tax where required. We do not display a crossed-out price unless that higher price was genuinely charged previously.' },
        { type: 'h', text: 'Delivery' },
        { type: 'p', text: 'Delivery estimates are estimates, not guarantees. Risk passes to you on delivery. See the shipping policy.' },
        { type: 'h', text: 'Returns' },
        { type: 'p', text: 'See the returns policy, which forms part of these terms.' },
        { type: 'h', text: 'Liability' },
        { type: 'p', text: 'Nothing in these terms excludes liability that cannot lawfully be excluded. [Insert the liability limits appropriate to your jurisdiction, reviewed by a lawyer.]' },
        { type: 'h', text: 'Governing law' },
        { type: 'p', text: '[Insert governing law and jurisdiction.]' },
        { type: 'note', text: LEGAL_PLACEHOLDER },
      ],
    },
  }
}

export function generateStaticParams() {
  return Object.keys(pages()).map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = pages()[slug]
  if (!page) return pageMetadata({ title: 'Not found', description: '', path: `/store/pages/${slug}`, noIndex: true })
  return pageMetadata({ title: page.title, description: page.intro, path: `/store/pages/${slug}` })
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = pages()[slug]
  if (!page) notFound()

  return (
    <>
      {page.faq && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(page.faq)) }}
        />
      )}
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
        <h1 className="commerce-display text-4xl text-ink-900 sm:text-5xl">{page.title}</h1>
        <p className="mt-4 max-w-prose text-[1.05rem] leading-relaxed text-ink-600">{page.intro}</p>

        <div className="mt-10 space-y-6">
          {page.blocks.map((block, i) => {
            if (block.type === 'h') {
              return (
                <h2 key={i} className="commerce-display pt-4 text-2xl text-ink-900">
                  {block.text}
                </h2>
              )
            }
            if (block.type === 'list') {
              return (
                <ul key={i} className="max-w-prose space-y-2 text-[1.05rem] leading-relaxed text-ink-700">
                  {block.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span aria-hidden className="text-ink-400">
                        —
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )
            }
            if (block.type === 'note') {
              return (
                <p
                  key={i}
                  className="max-w-prose rounded-xl border border-clay-500/40 bg-clay-400/10 p-4 text-sm leading-relaxed text-clay-600"
                >
                  {block.text}
                </p>
              )
            }
            return (
              <p key={i} className="max-w-prose text-[1.05rem] leading-relaxed text-ink-700">
                {block.text}
              </p>
            )
          })}

          {page.faq && (
            <div className="divide-y divide-ink-200 border-y border-ink-200">
              {page.faq.map((f) => (
                <details key={f.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1.05rem] font-medium text-ink-900">
                    {f.question}
                    <span className="text-ink-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2.5 max-w-prose text-[0.95rem] leading-relaxed text-ink-600">
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
          )}
        </div>

        <p className="mt-12 text-sm text-ink-500">
          Still not answered?{' '}
          <Link href="/store/contact" className="text-ink-900 underline underline-offset-4">
            Get in touch
          </Link>
          .
        </p>
      </div>
    </>
  )
}
