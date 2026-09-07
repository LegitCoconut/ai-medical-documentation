import { guard, jsonError } from '@/lib/auth'
import { nextMrn, patients } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { Patient } from '@/lib/types'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function GET(req: Request) {
  return guard(['reception', 'doctor'], async () => {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const col = await patients()

    const filter = q
      ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { mrn: new RegExp(escapeRegex(q), 'i') }, { phone: new RegExp(escapeRegex(q), 'i') }] }
      : {}
    const docs = await col.find(filter).sort({ createdAt: -1 }).limit(50).toArray()
    return { patients: serializeDocs<Patient>(docs) }
  })
}

export async function POST(req: Request) {
  return guard(['reception'], async (session) => {
    const body = await req.json()
    const name = String(body.name ?? '').trim()
    const age = Number(body.age)
    const sex = body.sex
    const phone = String(body.phone ?? '').trim()
    const address = body.address ? String(body.address).trim() : ''
    const allergies = body.allergies ? String(body.allergies).trim() : ''

    if (!name) throw jsonError('Name is required', 400)
    if (!Number.isInteger(age) || age < 0 || age > 120)
      throw jsonError('Age must be an integer between 0 and 120', 400)
    if (!['M', 'F', 'O'].includes(sex)) throw jsonError('Sex must be M, F or O', 400)
    if (phone.replace(/\D/g, '').length < 10) throw jsonError('Phone must have at least 10 digits', 400)

    const mrn = await nextMrn()
    const col = await patients()
    const doc = {
      mrn,
      name,
      age,
      sex,
      phone,
      address,
      allergies,
      createdAt: new Date(),
      createdBy: session.uid,
    }
    const res = await col.insertOne(doc)
    return { patient: serializeDoc<Patient>({ ...doc, _id: res.insertedId }) }
  })
}
