import { users } from '@/lib/db'
import { guard, hashPassword, jsonError } from '@/lib/auth'
import { serializeDoc, serializeDocs, type Role, type User } from '@/lib/types'

const ROLES: Role[] = ['admin', 'reception', 'doctor']

export async function GET(req: Request) {
  return guard(['admin'], async () => {
    const role = new URL(req.url).searchParams.get('role')
    const filter = role && ROLES.includes(role as Role) ? { role } : {}
    const col = await users()
    const docs = await col
      .find(filter, { projection: { passwordHash: 0 } })
      .sort({ role: 1, name: 1 })
      .toArray()
    return { users: serializeDocs<User>(docs) }
  })
}

export async function POST(req: Request) {
  return guard(['admin'], async () => {
    const body = await req.json()
    const username = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim()
    const role = body.role as Role
    const department = body.department ? String(body.department).trim() : undefined

    if (username.length < 3 || !/^[a-z0-9._-]+$/.test(username)) {
      throw jsonError('Username must be 3+ characters, lowercase letters/digits/._- only', 400)
    }
    if (password.length < 6) throw jsonError('Password must be at least 6 characters', 400)
    if (!name) throw jsonError('Name is required', 400)
    if (!ROLES.includes(role)) throw jsonError('Invalid role', 400)

    const col = await users()
    if (await col.findOne({ username })) throw jsonError('Username already exists', 409)

    const doc = {
      username,
      passwordHash: await hashPassword(password),
      name,
      role,
      department,
      active: true,
      createdAt: new Date(),
    }
    const res = await col.insertOne(doc)
    const { passwordHash: _, ...rest } = doc
    void _
    return { user: serializeDoc<User>({ _id: res.insertedId, ...rest }) }
  })
}
