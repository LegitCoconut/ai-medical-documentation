import { MongoClient, Db, Collection } from 'mongodb'

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB || 'phc'

type Cached = { client: MongoClient; db: Db; indexed: boolean }
const g = globalThis as unknown as { __phcMongo?: Promise<Cached> }

async function connect(): Promise<Cached> {
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const cached: Cached = { client, db, indexed: false }
  await ensureIndexes(db)
  cached.indexed = true
  return cached
}

function getCached(): Promise<Cached> {
  if (!g.__phcMongo) g.__phcMongo = connect()
  return g.__phcMongo
}

export async function getDb(): Promise<Db> {
  const { db } = await getCached()
  return db
}

async function ensureIndexes(db: Db) {
  await db.collection('users').createIndex({ username: 1 }, { unique: true })
  await db.collection('patients').createIndex({ mrn: 1 }, { unique: true })
  await db.collection('patients').createIndex({ name: 1 })
  await db.collection('visits').createIndex({ status: 1 })
  await db.collection('visits').createIndex({ createdAt: 1 })
}

export async function users(): Promise<Collection> {
  return (await getDb()).collection('users')
}

export async function patients(): Promise<Collection> {
  return (await getDb()).collection('patients')
}

export async function visits(): Promise<Collection> {
  return (await getDb()).collection('visits')
}

type Counter = { _id: string; seq: number }

export async function nextMrn(): Promise<string> {
  const db = await getDb()
  const res = await db
    .collection<Counter>('counters')
    .findOneAndUpdate(
      { _id: 'mrn' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    )
  const seq = res?.seq ?? 1
  return `P-${String(seq).padStart(4, '0')}`
}
