import { ObjectId } from 'mongodb'

export type Role = 'admin' | 'reception' | 'doctor'

export type Session = { uid: string; role: Role; name: string; username: string }

export type User = {
  _id: string
  username: string
  name: string
  role: Role
  department?: string
  active: boolean
  createdAt: string
}

export type Patient = {
  _id: string
  mrn: string
  name: string
  age: number
  sex: 'M' | 'F' | 'O'
  phone: string
  address?: string
  allergies?: string
  createdAt: string
  createdBy: string
}

export type Vitals = {
  bp?: string
  temp?: string
  pulse?: string
  weight?: string
  spo2?: string
}

export type DiagnosisItem = {
  id: string
  text: string
  category: 'symptom' | 'finding' | 'vital' | 'assessment' | 'other'
  source: 'ai' | 'manual'
  at: string
}

export type PrescriptionItem = {
  id: string
  drug: string
  dose: string
  frequency: string
  duration: string
  notes: string
  source: 'ai' | 'manual'
  at: string
}

export type Visit = {
  _id: string
  patientId: string
  doctorId: string | null
  status: 'waiting' | 'in_progress' | 'completed'
  reason: string
  vitals: Vitals
  diagnosis: DiagnosisItem[]
  prescription: PrescriptionItem[]
  transcript: { id: string; text: string; at: string }[]
  notes: string
  createdBy: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

function serializeValue(v: unknown): unknown {
  if (v instanceof ObjectId) return v.toString()
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(serializeValue)
  if (v && typeof v === 'object') return serializeDoc(v as Record<string, unknown>)
  return v
}

export function serializeDoc<T>(doc: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(doc)) out[k] = serializeValue(val)
  return out as T
}

export function serializeDocs<T>(docs: Record<string, unknown>[]): T[] {
  return docs.map((d) => serializeDoc<T>(d))
}
