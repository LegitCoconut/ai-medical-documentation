import { users } from '@/lib/db'
import { guard } from '@/lib/auth'
import { serializeDocs, type User } from '@/lib/types'

/**
 * GET /api/users/doctors
 * Returns all active users with role=doctor.
 * Accessible by reception and admin (not just admin).
 */
export async function GET() {
  return guard(['reception', 'admin'], async () => {
    const col = await users()
    const docs = await col
      .find({ role: 'doctor', active: true }, { projection: { passwordHash: 0 } })
      .sort({ name: 1 })
      .toArray()
    return { doctors: serializeDocs<User>(docs) }
  })
}
