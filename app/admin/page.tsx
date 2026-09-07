import { getSession } from '@/lib/auth'
import { users } from '@/lib/db'
import { serializeDocs, type User } from '@/lib/types'
import { Shell } from '@/components/Shell'
import { StaffManager } from './StaffManager'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) return null

  const col = await users()
  const docs = await col
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ role: 1, name: 1 })
    .toArray()

  return (
    <Shell role="admin" user={session} title="Staff accounts">
      <StaffManager initialUsers={serializeDocs<User>(docs)} />
    </Shell>
  )
}
