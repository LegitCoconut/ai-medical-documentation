'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import type { Role } from '@/lib/types'
import { Button } from './ui'

type NavItem = { label: string; href: string }

const navByRole: Record<Role, NavItem[]> = {
  admin: [{ label: 'Staff', href: '/admin' }],
  reception: [
    { label: 'Today', href: '/reception' },
    { label: 'Patients', href: '/reception/patients' },
    { label: 'Register patient', href: '/reception/patients/new' },
  ],
  doctor: [
    { label: 'Queue', href: '/doctor' },
    { label: 'Patients', href: '/doctor/patients' },
  ],
}

// navbar bar / active-tab / role-label colours per role
const themeByRole: Record<Role, { bar: string; active: string; label: string }> = {
  admin: { bar: 'bg-gradient-to-r from-indigo-900 to-violet-800', active: 'bg-violet-500', label: '!text-violet-200' },
  doctor: { bar: 'bg-gradient-to-r from-teal-900 to-emerald-800', active: 'bg-emerald-500', label: '!text-emerald-200' },
  reception: { bar: 'bg-gradient-to-r from-sky-900 to-blue-800', active: 'bg-sky-500', label: '!text-sky-200' },
}

function SignOutButton() {
  const router = useRouter()
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <Button variant="ghost" size="sm" className="!text-white hover:!bg-white/10" onClick={signOut}>
      Sign out
    </Button>
  )
}

export function Shell({
  role,
  user,
  children,
}: {
  role: Role
  user: { name: string; username: string }
  /** accepted for call-site compatibility; each page renders its own PageHeader */
  title?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const items = navByRole[role]
  const theme = themeByRole[role]
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <div className="min-h-screen flex flex-col">
      <header className={`sticky top-0 z-20 h-14 shrink-0 ${theme.bar} text-white shadow-md flex items-center gap-5 px-6 overflow-x-auto`}>
        <span className="text-[13px] font-semibold tracking-[0.18em] uppercase whitespace-nowrap shrink-0">
          PHC Consult
        </span>
        <span className="h-5 w-px bg-white/25 shrink-0" />
        <nav className="flex items-center gap-1 whitespace-nowrap shrink-0">
          {items.map((item) => {
            const active = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded text-[13px] font-medium ${
                  active
                    ? `${theme.active} text-white`
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-baseline gap-1.5 pr-3 border-r border-white/25">
            <span className="text-[13px] font-medium">{user.name}</span>
            <span className={`label-xs ${theme.label}`}>{role}</span>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6">{children}</main>
    </div>
  )
}
