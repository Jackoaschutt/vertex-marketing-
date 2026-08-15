import type { Metadata } from 'next'
import { brand } from '@/lib/commerce/brand'
import { pageMetadata } from '@/lib/commerce/seo'
import { ContactForm } from '@/components/store/ContactForm'

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description: `Get in touch with ${brand.name}. We reply ${brand.contact.responseWindow}.`,
  path: '/store/contact',
})

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="commerce-display text-4xl text-ink-900 sm:text-5xl">Contact</h1>
      <p className="mt-4 max-w-prose text-[1.05rem] leading-relaxed text-ink-600">
        A person reads every message and replies {brand.contact.responseWindow}. If it is about an
        order, include the order number and it will be quicker.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_16rem]">
        <ContactForm responseWindow={brand.contact.responseWindow} />

        <aside className="h-fit space-y-5 rounded-2xl border border-ink-200 bg-sand-50 p-5 text-sm">
          <div>
            <p className="commerce-eyebrow text-ink-500">Email</p>
            <p className="mt-1.5 text-ink-800">{brand.contact.supportEmail}</p>
          </div>
          <div>
            <p className="commerce-eyebrow text-ink-500">Post</p>
            <address className="mt-1.5 not-italic leading-relaxed text-ink-800">
              {brand.legalName}
              <br />
              {brand.contact.addressLines.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </address>
          </div>
          <div>
            <p className="commerce-eyebrow text-ink-500">Response time</p>
            <p className="mt-1.5 text-ink-800">{brand.contact.responseWindow}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
