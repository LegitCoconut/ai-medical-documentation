import { ObjectId } from 'mongodb'
import { guard, jsonError } from '@/lib/auth'
import { patients, visits } from '@/lib/db'
import { serializeDoc, serializeDocs } from '@/lib/types'
import type { Patient, Visit } from '@/lib/types'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return guard(['reception', 'doctor'], async () => {
    let _id: ObjectId
    try {
      _id = new ObjectId(id)
    } catch {
      throw jsonError('Patient not found', 404)
    }
    const patientDoc = await (await patients()).findOne({ _id })
    if (!patientDoc) throw jsonError('Patient not found', 404)

    const visitDocs = await (await visits())
      .find({ patientId: id })
      .sort({ createdAt: -1 })
      .toArray()

    return {
      patient: serializeDoc<Patient>(patientDoc),
      visits: serializeDocs<Visit>(visitDocs),
    }
  })
}
