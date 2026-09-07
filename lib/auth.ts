import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import type { Role, Session } from './types'

export const SESSION_COOKIE = 'phc_session'

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me')
}

export async function signSession(payload: Session): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret())
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as Session
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySession(token)
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession()
  if (!session) throw jsonError('Unauthorized', 401)
  if (roles.length && !roles.includes(session.role)) throw jsonError('Forbidden', 403)
  return session
}

export async function guard<T>(
  roles: Role[],
  fn: (session: Session) => Promise<T>
): Promise<Response> {
  try {
    const session = await requireRole(...roles)
    const result = await fn(session)
    return Response.json(result as object)
  } catch (err) {
    if (err instanceof Response) return err
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonError(message, 500)
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
