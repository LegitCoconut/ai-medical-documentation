import { users } from '@/lib/db'
import { jsonError, signSession, verifyPassword, SESSION_COOKIE } from '@/lib/auth'
import type { Role } from '@/lib/types'

type UserDoc = {
  _id: unknown
  username: string
  passwordHash: string
  name: string
  role: Role
  active: boolean
}

export async function POST(req: Request) {
  const { username, password } = await req.json()
  if (!username || !password) return jsonError('Username and password required', 400)

  const col = await users()
  const user = (await col.findOne({ username: String(username).toLowerCase() })) as UserDoc | null
  if (!user || !user.active) return jsonError('Invalid credentials', 401)

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return jsonError('Invalid credentials', 401)

  const token = await signSession({
    uid: String(user._id),
    role: user.role,
    name: user.name,
    username: user.username,
  })

  const res = Response.json({ role: user.role })
  res.headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
  )
  return res
}
