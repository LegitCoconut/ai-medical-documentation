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

function SignOutButton() {
  const router = useRouter()
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <Button variant="ghost" size="sm" onClick={signOut}>
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
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 h-14 shrink-0 bg-[var(--surface)] border-b border-[var(--border)] flex items-center gap-5 px-6 overflow-x-auto">
        <span className="text-[13px] font-semibold tracking-[0.18em] uppercase whitespace-nowrap shrink-0">
          PHC Consult
        </span>
        <span className="h-5 w-px bg-[var(--border)] shrink-0" />
        <nav className="flex items-center gap-1 whitespace-nowrap shrink-0">
          {items.map((item) => {
            const active = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded text-[13px] font-medium ${
                  active
                    ? 'bg-[var(--text)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[#f2f2f2]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-baseline gap-1.5 pr-3 border-r border-[var(--border)]">
            <span className="text-[13px] font-medium">{user.name}</span>
            <span className="label-xs">{role}</span>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6">{children}</main>
    </div>
  )
}
