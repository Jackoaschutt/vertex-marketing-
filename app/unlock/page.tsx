import type { Metadata } from 'next'
import { isPasscodeConfigured } from '@/lib/commerce/auth'
import { UnlockForm } from '@/components/ops/UnlockForm'

export const metadata: Metadata = {
  title: 'Locked',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function UnlockPage() {
  const configured = isPasscodeConfigured()

  return (
    <div className="commerce-scope flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-8">
        <p className="commerce-eyebrow text-ink-500">Private</p>
        <h1 className="commerce-display mt-3 text-3xl text-ink-900">Locked</h1>

        {configured ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              This tool holds real financials. Enter your passcode to unlock it on this device.
            </p>
            <div className="mt-6">
              <UnlockForm />
            </div>
          </>
        ) : (
          <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-700">
            <code className="rounded bg-ink-100 px-1">ADMIN_PASSCODE</code> is not set on the
            server, so nothing can unlock this. Set it in your environment variables and redeploy —
            it is the only credential this tool has.
          </p>
        )}
      </div>
    </div>
  )
}
