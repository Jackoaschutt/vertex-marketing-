import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavLinks from './NavLinks'
import SignOutButton from './SignOutButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0f1a]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0d1220] border-r border-slate-800/60 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight">PropGuard</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4">
          <NavLinks />
        </nav>

        {/* User / Sign out */}
        <div className="px-4 py-4 border-t border-slate-800/60">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-teal-400 uppercase">
                {user.email?.[0] ?? '?'}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#0b0f1a] px-8 py-8">
        {children}
      </main>
    </div>
  )
}
