import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PropGuard — Auth',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-3xl font-bold text-sky-500 tracking-tight">PropGuard</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-zinc-900 rounded-xl shadow-xl p-8">
        {children}
      </div>
    </div>
  )
}
