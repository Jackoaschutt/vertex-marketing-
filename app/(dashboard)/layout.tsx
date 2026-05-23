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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-zinc-800">
          <span className="text-xl font-bold text-sky-400">🛡 PropGuard</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4">
          <NavLinks />
        </nav>

        {/* User / Sign out */}
        <div className="px-4 py-4 border-t border-zinc-800 space-y-3">
          <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-zinc-900 p-8">
        {children}
      </main>
    </div>
  )
}
