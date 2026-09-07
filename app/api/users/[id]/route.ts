import { ObjectId } from 'mongodb'
import { users } from '@/lib/db'
import { guard, hashPassword, jsonError } from '@/lib/auth'
import { serializeDoc, type Session, type User } from '@/lib/types'

function toObjectId(id: string): ObjectId {
  try {
    return new ObjectId(id)
  } catch {
    throw jsonError('Invalid user id', 400)
  }
}

// Refuses to deactivate the caller's own account or the last active admin.
async function assertCanDeactivate(session: Session, id: string, _id: ObjectId) {
  if (id === session.uid) throw jsonError('Cannot deactivate your own account', 400)
  const col = await users()
  const target = await col.findOne({ _id })
  if (!target) throw jsonError('User not found', 404)
  if (target.role === 'admin') {
    const otherActiveAdmins = await col.countDocuments({
      role: 'admin',
      active: true,
      _id: { $ne: _id },
    })
    if (otherActiveAdmins === 0) throw jsonError('Cannot deactivate the last active admin', 400)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guard(['admin'], async (session) => {
    const { id } = await params
    const _id = toObjectId(id)
    const body = await req.json()
    const update: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) throw jsonError('Name is required', 400)
      update.name = name
    }
    if (typeof body.department === 'string') update.department = body.department.trim()
    if (typeof body.active === 'boolean') {
      if (body.active === false) await assertCanDeactivate(session, id, _id)
      update.active = body.active
    }
    if (typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 6) throw jsonError('Password must be at least 6 characters', 400)
      update.passwordHash = await hashPassword(body.password)
    }
    if (!Object.keys(update).length) throw jsonError('No valid fields to update', 400)

    const col = await users()
    const result = await col.findOneAndUpdate(
      { _id },
      { $set: update },
      { returnDocument: 'after', projection: { passwordHash: 0 } }
    )
    if (!result) throw jsonError('User not found', 404)
    return { user: serializeDoc<User>(result) }
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guard(['admin'], async (session) => {
    const { id } = await params
    const _id = toObjectId(id)
    await assertCanDeactivate(session, id, _id)
    const col = await users()
    const result = await col.updateOne({ _id }, { $set: { active: false } })
    if (!result.matchedCount) throw jsonError('User not found', 404)
    return { ok: true }
  })
}
