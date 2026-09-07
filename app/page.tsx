import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

const roleHome: Record<string, string> = {
  admin: '/admin',
  reception: '/reception',
  doctor: '/doctor',
}

export default async function Home() {
  const session = await getSession()
  redirect(session ? roleHome[session.role] : '/login')
}
