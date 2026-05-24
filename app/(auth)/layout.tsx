import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PropGuard — Auth',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">PropGuard</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#111827] border border-slate-800/50 rounded-2xl shadow-2xl p-8">
        {children}
      </div>
    </div>
  )
}
