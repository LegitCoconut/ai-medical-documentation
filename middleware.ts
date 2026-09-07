import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'phc_session'

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me')
}

const roleHome: Record<string, string> = {
  admin: '/admin',
  reception: '/reception',
  doctor: '/doctor',
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const match = pathname.match(/^\/(admin|reception|doctor)(\/|$)/)
  if (!match) return NextResponse.next()
  const requiredRole = match[1]

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const { payload } = await jwtVerify(token, secret())
    const role = payload.role as string
    if (role !== requiredRole) {
      return NextResponse.redirect(new URL(roleHome[role] || '/login', req.url))
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*', '/reception/:path*', '/doctor/:path*'],
}
