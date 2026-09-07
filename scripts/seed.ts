import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import type { Vitals, DiagnosisItem, PrescriptionItem } from '../lib/types'

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB || 'phc'
const RESET = process.argv.includes('--reset')

async function upsertUser(
  db: import('mongodb').Db,
  username: string,
  password: string,
  name: string,
  role: 'admin' | 'reception' | 'doctor',
  department?: string
) {
  const passwordHash = await bcrypt.hash(password, 10)
  await db.collection('users').updateOne(
    { username },
    {
      $set: { passwordHash, name, role, department, active: true },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  )
  return db.collection('users').findOne({ username })
}

async function upsertPatient(
  db: import('mongodb').Db,
  mrn: string,
  data: {
    name: string
    age: number
    sex: 'M' | 'F' | 'O'
    phone: string
    address?: string
    allergies?: string
  },
  createdBy: string,
  registeredAt: Date
) {
  await db.collection('patients').updateOne(
    { mrn },
    { $set: { ...data, mrn }, $setOnInsert: { createdAt: registeredAt, createdBy } },
    { upsert: true }
  )
  return db.collection('patients').findOne({ mrn })
}

type PatientSeed = {
  mrn: string
  name: string
  age: number
  sex: 'M' | 'F' | 'O'
  phone: string
  address: string
  allergies?: string
}

const patients: PatientSeed[] = [
  { mrn: 'P-0001', name: 'Ramesh Kumar', age: 54, sex: 'M', phone: '9876500001', address: 'Village Rd 1', allergies: 'Penicillin' },
  { mrn: 'P-0002', name: 'Sita Devi', age: 31, sex: 'F', phone: '9876500002', address: 'Village Rd 2' },
  { mrn: 'P-0003', name: 'Arjun Singh', age: 8, sex: 'M', phone: '9876500003', address: 'Village Rd 3' },
  { mrn: 'P-0004', name: 'Lakshmi Reddy', age: 26, sex: 'F', phone: '9876500004', address: 'Ankapalli Village, Ward 5' },
  { mrn: 'P-0005', name: 'Krishnan Nair', age: 62, sex: 'M', phone: '9876500005', address: 'Thiruvallur PHC Road', allergies: 'Aspirin' },
  { mrn: 'P-0006', name: 'Fatima Begum', age: 45, sex: 'F', phone: '9876500006', address: 'Chandni Mohalla, Sadar Bazar' },
  { mrn: 'P-0007', name: 'Suresh Patil', age: 35, sex: 'M', phone: '9876500007', address: 'Wadgaon Village' },
  { mrn: 'P-0008', name: 'Kamala Bai', age: 58, sex: 'F', phone: '9876500008', address: 'Gandhi Nagar Colony', allergies: 'Sulfa drugs' },
  { mrn: 'P-0009', name: 'Vikram Joshi', age: 22, sex: 'M', phone: '9876500009', address: 'Rajpura Village' },
  { mrn: 'P-0010', name: 'Parvati Amma', age: 70, sex: 'F', phone: '9876500010', address: 'Kamalapuram Village' },
  { mrn: 'P-0011', name: 'Ananya Sharma', age: 2, sex: 'F', phone: '9876500011', address: 'Nehru Colony, Sector 4' },
  { mrn: 'P-0012', name: 'Manoj Verma', age: 40, sex: 'M', phone: '9876500012', address: 'Bishanpur Village' },
]

type DxSpec = { text: string; category: DiagnosisItem['category']; source: 'ai' | 'manual' }
type RxSpec = { drug: string; dose: string; frequency: string; duration: string; notes: string; source: 'ai' | 'manual' }
type VisitSpec = {
  mrn: string
  date: string
  durationMin: number
  reason: string
  vitals: Vitals
  diagnosis: DxSpec[]
  prescription: RxSpec[]
  notes: string
  transcript: string[]
}

const visitSpecs: VisitSpec[] = [
  {
    mrn: 'P-0001', date: '2025-12-15T09:00:00+05:30', durationMin: 18,
    reason: 'Follow-up for high blood pressure, occasional headache',
    vitals: { bp: '158/96', temp: '36.8', pulse: '88', weight: '76', spo2: '98' },
    diagnosis: [
      { text: 'Headache and occasional dizziness', category: 'symptom', source: 'manual' },
      { text: 'BP 158/96 on repeat measurement', category: 'finding', source: 'ai' },
      { text: 'Newly detected essential hypertension', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Amlodipine', dose: '5 mg', frequency: 'OD', duration: '1 month', notes: 'Take in the morning', source: 'manual' },
    ],
    notes: 'Start Amlodipine, low salt diet, review in one month. Patient has known Penicillin allergy.',
    transcript: [
      'BP reading is 158 over 96, patient reports occasional headache for two weeks.',
      'Starting tab Amlodipine 5 mg once daily. Advised low-salt diet and review after a month.',
    ],
  },
  {
    mrn: 'P-0001', date: '2026-02-03T10:15:00+05:30', durationMin: 15,
    reason: 'Fever and sore throat for 2 days',
    vitals: { bp: '132/84', temp: '38.2', pulse: '94', weight: '76', spo2: '97' },
    diagnosis: [
      { text: 'Sore throat and fever', category: 'symptom', source: 'manual' },
      { text: 'Congested throat on examination, no tonsillar exudate', category: 'finding', source: 'ai' },
      { text: 'Acute upper respiratory tract infection', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Azithromycin', dose: '500 mg', frequency: 'OD', duration: '3 days', notes: 'Penicillin allergy on record, azithromycin used instead', source: 'manual' },
      { drug: 'Paracetamol', dose: '500 mg', frequency: 'TDS', duration: '3 days', notes: 'For fever', source: 'ai' },
    ],
    notes: 'Avoided penicillin group due to known allergy. Continue Amlodipine as before.',
    transcript: [
      'Throat is congested, no exudate seen. Patient has penicillin allergy so starting tab Azithromycin 500 mg once daily for three days instead.',
      'Continue regular BP medication.',
    ],
  },
  {
    mrn: 'P-0001', date: '2026-04-20T09:30:00+05:30', durationMin: 14,
    reason: 'Routine blood pressure review',
    vitals: { bp: '138/86', temp: '36.9', pulse: '82', weight: '75', spo2: '98' },
    diagnosis: [
      { text: 'Asymptomatic, no headache or chest pain', category: 'symptom', source: 'manual' },
      { text: 'BP improved to 138/86', category: 'vital', source: 'ai' },
      { text: 'Hypertension, partially controlled', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Amlodipine', dose: '5 mg', frequency: 'OD', duration: '1 month', notes: 'Continue same dose', source: 'manual' },
    ],
    notes: 'BP trending down. Continue current dose and lifestyle measures.',
    transcript: ['BP today is 138 over 86, better than last visit. Continue Amlodipine 5 mg once daily.'],
  },
  {
    mrn: 'P-0001', date: '2026-07-10T09:00:00+05:30', durationMin: 13,
    reason: 'Routine blood pressure review',
    vitals: { bp: '128/82', temp: '36.7', pulse: '78', weight: '74', spo2: '98' },
    diagnosis: [
      { text: 'No headache, feeling well', category: 'symptom', source: 'manual' },
      { text: 'BP well controlled at 128/82', category: 'vital', source: 'ai' },
      { text: 'Hypertension, well controlled', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Amlodipine', dose: '5 mg', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'ai' },
    ],
    notes: 'Good control. Continue same medication, review in a month.',
    transcript: ['Blood pressure well controlled at 128 over 82. Continue same treatment.'],
  },
  {
    mrn: 'P-0002', date: '2026-01-10T11:00:00+05:30', durationMin: 16,
    reason: 'Burning pain in upper abdomen after meals for a week',
    vitals: { bp: '116/74', temp: '36.8', pulse: '82', weight: '57', spo2: '99' },
    diagnosis: [
      { text: 'Burning epigastric pain after food', category: 'symptom', source: 'manual' },
      { text: 'Epigastric tenderness on palpation', category: 'finding', source: 'ai' },
      { text: 'Acid peptic disease', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Pantoprazole', dose: '40 mg', frequency: 'OD', duration: '15 days', notes: 'Before breakfast', source: 'manual' },
      { drug: 'Domperidone', dose: '10 mg', frequency: 'TDS', duration: '5 days', notes: 'Before meals', source: 'ai' },
    ],
    notes: 'Avoid spicy food, caffeine and NSAIDs. Review in two weeks.',
    transcript: [
      'Epigastric tenderness present on palpation, no rebound. Likely acid peptic disease.',
      'Start tab Pantoprazole 40 mg once daily before breakfast, and Domperidone before meals.',
    ],
  },
  {
    mrn: 'P-0002', date: '2026-03-05T11:30:00+05:30', durationMin: 12,
    reason: 'Follow-up for abdominal pain, feeling better',
    vitals: { bp: '114/72', temp: '36.7', pulse: '78', weight: '58', spo2: '99' },
    diagnosis: [
      { text: 'Significant improvement in epigastric pain', category: 'symptom', source: 'manual' },
      { text: 'No tenderness on abdominal examination', category: 'finding', source: 'ai' },
      { text: 'Acid peptic disease, resolving', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Pantoprazole', dose: '40 mg', frequency: 'OD', duration: '15 days', notes: 'Taper and stop if asymptomatic', source: 'manual' },
    ],
    notes: 'Advised to continue avoiding spicy food and NSAIDs.',
    transcript: ['No tenderness now, patient reports much less discomfort. Continue Pantoprazole for two more weeks and then stop.'],
  },
  {
    mrn: 'P-0003', date: '2025-12-20T10:00:00+05:30', durationMin: 20,
    reason: 'Loose stools and vomiting since yesterday',
    vitals: { temp: '37.9', pulse: '110', weight: '22', spo2: '98' },
    diagnosis: [
      { text: 'Loose stools 5-6 times and two episodes of vomiting', category: 'symptom', source: 'manual' },
      { text: 'Mild dehydration, dry lips', category: 'finding', source: 'ai' },
      { text: 'Acute gastroenteritis with mild dehydration', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'ORS', dose: '200 ml', frequency: 'SOS', duration: '5 days', notes: 'After each loose stool', source: 'manual' },
      { drug: 'Zinc Sulphate', dose: '20 mg', frequency: 'OD', duration: '14 days', notes: '', source: 'ai' },
    ],
    notes: 'Advised plenty of fluids, continue feeding, return if worsening.',
    transcript: ['Mild dehydration noted, dry lips. Start ORS after each loose stool and Zinc for fourteen days.'],
  },
  {
    mrn: 'P-0003', date: '2026-03-15T10:30:00+05:30', durationMin: 12,
    reason: 'Routine deworming, mother requests',
    vitals: { temp: '36.8', pulse: '92', weight: '23', spo2: '99' },
    diagnosis: [
      { text: 'No current symptoms, well child', category: 'symptom', source: 'manual' },
      { text: 'Abdomen soft, non-tender', category: 'finding', source: 'ai' },
      { text: 'Prophylactic deworming', category: 'other', source: 'manual' },
    ],
    prescription: [
      { drug: 'Albendazole', dose: '400 mg', frequency: 'STAT', duration: '1 day', notes: 'Single dose after food', source: 'manual' },
    ],
    notes: 'Routine six-monthly deworming given.',
    transcript: ['Abdomen soft and non-tender. Giving single dose tab Albendazole 400 mg after food.'],
  },
  {
    mrn: 'P-0003', date: '2026-06-02T09:45:00+05:30', durationMin: 14,
    reason: 'Runny nose and mild cough for 2 days',
    vitals: { temp: '37.4', pulse: '100', weight: '23', spo2: '98' },
    diagnosis: [
      { text: 'Runny nose and mild dry cough', category: 'symptom', source: 'manual' },
      { text: 'Throat mildly congested, chest clear on auscultation', category: 'finding', source: 'ai' },
      { text: 'Viral upper respiratory infection', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Paracetamol', dose: '250 mg', frequency: 'TDS', duration: '3 days', notes: 'If fever', source: 'ai' },
      { drug: 'Cetirizine', dose: '5 mg', frequency: 'OD', duration: '5 days', notes: 'At night', source: 'manual' },
    ],
    notes: 'Symptomatic viral infection, advised warm fluids and rest.',
    transcript: ['Chest is clear on auscultation, no added sounds. This looks like a viral URI, symptomatic treatment only.'],
  },
  {
    mrn: 'P-0004', date: '2026-02-12T10:00:00+05:30', durationMin: 18,
    reason: 'Antenatal checkup, 5 months pregnant, feels tired',
    vitals: { bp: '108/70', temp: '36.7', pulse: '88', weight: '58', spo2: '99' },
    diagnosis: [
      { text: 'Easy fatigue and occasional giddiness', category: 'symptom', source: 'manual' },
      { text: 'Pallor noted on conjunctiva', category: 'finding', source: 'ai' },
      { text: 'Iron deficiency anaemia in pregnancy', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Iron and Folic Acid', dose: '1 tab', frequency: 'OD', duration: '1 month', notes: 'After food', source: 'manual' },
      { drug: 'Calcium with Vitamin D3', dose: '1 tab', frequency: 'OD', duration: '1 month', notes: '', source: 'ai' },
    ],
    notes: 'Hb 9.8 g/dL on testing today. Advised iron-rich diet, review in 6 weeks with repeat Hb.',
    transcript: ['Conjunctival pallor present. Hb comes to 9.8, starting iron and folic acid along with calcium.'],
  },
  {
    mrn: 'P-0004', date: '2026-05-20T10:15:00+05:30', durationMin: 15,
    reason: 'Antenatal follow-up, 7 months pregnant',
    vitals: { bp: '112/72', temp: '36.6', pulse: '84', weight: '62', spo2: '99' },
    diagnosis: [
      { text: 'Feels less tired than before', category: 'symptom', source: 'manual' },
      { text: 'Pallor improved, mild', category: 'finding', source: 'ai' },
      { text: 'Iron deficiency anaemia in pregnancy, improving', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Iron and Folic Acid', dose: '1 tab', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'manual' },
      { drug: 'Calcium with Vitamin D3', dose: '1 tab', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'ai' },
    ],
    notes: 'Repeat Hb today is 11.2 g/dL, good improvement. Continue supplements till delivery.',
    transcript: ['Hb has improved to 11.2 from 9.8. Continue same supplements.'],
  },
  {
    mrn: 'P-0005', date: '2025-12-05T09:15:00+05:30', durationMin: 20,
    reason: 'Increased thirst and frequent urination for a month',
    vitals: { bp: '138/88', temp: '36.8', pulse: '84', weight: '82', spo2: '97' },
    diagnosis: [
      { text: 'Polyuria and increased thirst', category: 'symptom', source: 'manual' },
      { text: 'Random blood sugar markedly elevated', category: 'finding', source: 'ai' },
      { text: 'Newly diagnosed Type 2 Diabetes Mellitus', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Metformin', dose: '500 mg', frequency: 'OD', duration: '1 month', notes: 'After dinner', source: 'manual' },
    ],
    notes: 'Advised dietary modification, weight reduction and regular exercise. Review in a month with fasting sugar. Known Aspirin allergy noted.',
    transcript: ['Random sugar is high, classic osmotic symptoms present. Starting tab Metformin 500 mg once daily after dinner.'],
  },
  {
    mrn: 'P-0005', date: '2026-03-10T09:30:00+05:30', durationMin: 18,
    reason: 'Follow-up for diabetes, sugars still high',
    vitals: { bp: '142/90', temp: '36.7', pulse: '82', weight: '80', spo2: '97' },
    diagnosis: [
      { text: 'Persistent polyuria despite medication', category: 'symptom', source: 'manual' },
      { text: 'Fasting sugar remains elevated on Metformin alone', category: 'finding', source: 'ai' },
      { text: 'Type 2 Diabetes Mellitus, inadequately controlled', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Metformin', dose: '500 mg', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'manual' },
      { drug: 'Glimepiride', dose: '1 mg', frequency: 'OD', duration: '1 month', notes: 'Before breakfast', source: 'ai' },
    ],
    notes: 'Adding Glimepiride. Reinforce diet and exercise. BP also borderline, monitor.',
    transcript: ['Sugars still uncontrolled on Metformin alone, adding tab Glimepiride 1 mg once daily before breakfast.'],
  },
  {
    mrn: 'P-0005', date: '2026-06-25T09:00:00+05:30', durationMin: 17,
    reason: 'Routine diabetes review',
    vitals: { bp: '134/84', temp: '36.6', pulse: '78', weight: '78', spo2: '98' },
    diagnosis: [
      { text: 'Feels well, no polyuria now', category: 'symptom', source: 'manual' },
      { text: 'Sugars better controlled, weight reduced by 4 kg', category: 'finding', source: 'ai' },
      { text: 'Type 2 Diabetes Mellitus with dyslipidemia', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Metformin', dose: '500 mg', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'manual' },
      { drug: 'Glimepiride', dose: '1 mg', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'manual' },
      { drug: 'Atorvastatin', dose: '10 mg', frequency: 'OD', duration: '1 month', notes: 'At night', source: 'ai' },
    ],
    notes: 'Lipid profile shows elevated cholesterol, starting statin. Continue lifestyle measures.',
    transcript: ['Weight down by four kilos, sugars trending better. Adding tab Atorvastatin 10 mg at night for cholesterol.'],
  },
  {
    mrn: 'P-0006', date: '2026-01-25T10:45:00+05:30', durationMin: 15,
    reason: 'Pain in both knees for 2 months, worse on stairs',
    vitals: { bp: '124/80', temp: '36.7', pulse: '80', weight: '68', spo2: '98' },
    diagnosis: [
      { text: 'Bilateral knee pain, worse climbing stairs', category: 'symptom', source: 'manual' },
      { text: 'Crepitus on knee movement, mild swelling', category: 'finding', source: 'ai' },
      { text: 'Osteoarthritis of both knees', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Diclofenac', dose: '50 mg', frequency: 'BD', duration: '5 days', notes: 'After food', source: 'manual' },
      { drug: 'Calcium with Vitamin D3', dose: '1 tab', frequency: 'OD', duration: '1 month', notes: '', source: 'ai' },
    ],
    notes: 'Advised weight reduction and quadriceps strengthening exercises.',
    transcript: [
      'Crepitus felt on both knees with mild swelling. Likely osteoarthritis. Starting Diclofenac for five days and calcium supplement.',
      'Advised weight reduction and quadriceps exercises daily.',
    ],
  },
  {
    mrn: 'P-0006', date: '2026-04-08T11:00:00+05:30', durationMin: 13,
    reason: 'Follow-up for knee pain, some improvement',
    vitals: { bp: '122/78', temp: '36.6', pulse: '78', weight: '66', spo2: '98' },
    diagnosis: [
      { text: 'Knee pain reduced, walking better', category: 'symptom', source: 'manual' },
      { text: 'Reduced swelling on examination', category: 'finding', source: 'ai' },
      { text: 'Osteoarthritis of both knees, improving', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Calcium with Vitamin D3', dose: '1 tab', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'manual' },
    ],
    notes: 'Diclofenac stopped. Continue exercises and weight reduction, lost 2 kg so far.',
    transcript: ['Swelling has reduced, patient has lost two kilos. Stop Diclofenac, continue calcium and exercises.'],
  },
  {
    mrn: 'P-0007', date: '2026-05-14T16:00:00+05:30', durationMin: 14,
    reason: 'Itching all over body, worse at night, for 10 days',
    vitals: { bp: '122/78', temp: '36.8', pulse: '82', weight: '70', spo2: '98' },
    diagnosis: [
      { text: 'Intense itching, worse at night', category: 'symptom', source: 'manual' },
      { text: 'Burrows seen between finger webs and wrists', category: 'finding', source: 'ai' },
      { text: 'Scabies', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Permethrin', dose: '5% lotion', frequency: 'STAT', duration: '1 day', notes: 'Apply overnight, wash off after 8-12 hours, repeat after a week', source: 'manual' },
      { drug: 'Cetirizine', dose: '10 mg', frequency: 'OD', duration: '5 days', notes: 'At night for itching', source: 'ai' },
    ],
    notes: 'Advised treating all household contacts simultaneously and hot-washing all clothes and linen.',
    transcript: [
      'Burrows visible in finger webs and wrists, classic scabies. Apply Permethrin lotion overnight, wash off next morning, repeat after one week.',
      'All household contacts should be treated together, and clothes and bedding hot-washed.',
    ],
  },
  {
    mrn: 'P-0008', date: '2026-02-28T10:00:00+05:30', durationMin: 16,
    reason: 'Recurrent wheeze and breathlessness for a week',
    vitals: { bp: '128/82', temp: '36.8', pulse: '92', weight: '64', spo2: '96' },
    diagnosis: [
      { text: 'Wheeze and breathlessness on exertion', category: 'symptom', source: 'manual' },
      { text: 'Bilateral rhonchi on chest auscultation', category: 'finding', source: 'ai' },
      { text: 'Bronchial asthma', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Salbutamol', dose: '100 mcg inhaler, 2 puffs', frequency: 'SOS', duration: '1 month', notes: 'When breathless', source: 'manual' },
      { drug: 'Budesonide', dose: '200 mcg inhaler', frequency: 'BD', duration: '1 month', notes: 'Regular use', source: 'ai' },
      { drug: 'Montelukast', dose: '10 mg', frequency: 'HS', duration: '1 month', notes: 'At bedtime', source: 'manual' },
    ],
    notes: 'Advised inhaler technique demonstration and avoidance of triggers. Known allergy to sulfa drugs noted.',
    transcript: ['Bilateral rhonchi heard on auscultation. Starting Salbutamol as rescue inhaler and Budesonide regularly, plus Montelukast at night.'],
  },
  {
    mrn: 'P-0008', date: '2026-06-18T09:30:00+05:30', durationMin: 22,
    reason: 'Acute worsening of breathlessness since morning',
    vitals: { bp: '130/84', temp: '37.0', pulse: '104', weight: '63', spo2: '92' },
    diagnosis: [
      { text: 'Severe breathlessness, unable to speak full sentences', category: 'symptom', source: 'manual' },
      { text: 'Widespread wheeze, SpO2 dropped to 92%', category: 'finding', source: 'ai' },
      { text: 'Acute exacerbation of bronchial asthma', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Salbutamol', dose: '100 mcg inhaler via spacer', frequency: 'QID', duration: '5 days', notes: 'Via spacer', source: 'manual' },
      { drug: 'Prednisolone', dose: '40 mg', frequency: 'OD', duration: '5 days', notes: 'Short course, morning dose', source: 'ai' },
      { drug: 'Budesonide', dose: '200 mcg inhaler', frequency: 'BD', duration: '1 month', notes: 'Continue', source: 'manual' },
    ],
    notes: 'SpO2 improved to 96% after nebulisation in clinic. Advised close follow-up, avoid sulfa-based drugs given known allergy.',
    transcript: [
      'SpO2 was 92 percent on arrival, widespread wheeze. Giving nebulised Salbutamol and starting a short course of oral Prednisolone.',
      'Continue Budesonide inhaler regularly, review in three days.',
    ],
  },
  {
    mrn: 'P-0009', date: '2026-07-02T15:00:00+05:30', durationMin: 12,
    reason: 'Burning sensation on urination and increased frequency for 3 days',
    vitals: { bp: '118/76', temp: '37.3', pulse: '88', weight: '68', spo2: '99' },
    diagnosis: [
      { text: 'Dysuria and urinary frequency', category: 'symptom', source: 'manual' },
      { text: 'Mild suprapubic tenderness', category: 'finding', source: 'ai' },
      { text: 'Urinary tract infection', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Nitrofurantoin', dose: '100 mg', frequency: 'BD', duration: '5 days', notes: 'After food', source: 'manual' },
    ],
    notes: 'Advised increased fluid intake and repeat urine test if symptoms persist.',
    transcript: ['Mild suprapubic tenderness present, no fever. Starting tab Nitrofurantoin 100 mg twice daily for five days and advising increased fluids.'],
  },
  {
    mrn: 'P-0010', date: '2026-01-08T09:00:00+05:30', durationMin: 16,
    reason: 'Headache and knee pain for a week',
    vitals: { bp: '162/94', temp: '36.7', pulse: '84', weight: '58', spo2: '97' },
    diagnosis: [
      { text: 'Headache and bilateral knee discomfort', category: 'symptom', source: 'manual' },
      { text: 'BP elevated at 162/94, mild knee crepitus', category: 'finding', source: 'ai' },
      { text: 'Hypertension with osteoarthritis of knees', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Telmisartan', dose: '40 mg', frequency: 'OD', duration: '1 month', notes: 'Morning', source: 'manual' },
      { drug: 'Calcium with Vitamin D3', dose: '1 tab', frequency: 'OD', duration: '1 month', notes: '', source: 'ai' },
    ],
    notes: 'Advised salt restriction, gentle knee exercises. Review in a month.',
    transcript: ['BP is 162 over 94 today, starting tab Telmisartan 40 mg once daily. Knees show mild crepitus, giving calcium supplement.'],
  },
  {
    mrn: 'P-0010', date: '2026-04-30T09:30:00+05:30', durationMin: 15,
    reason: 'Follow-up, also complains of tingling in feet',
    vitals: { bp: '140/88', temp: '36.7', pulse: '80', weight: '58', spo2: '97' },
    diagnosis: [
      { text: 'BP improved, new tingling sensation in both feet', category: 'symptom', source: 'manual' },
      { text: 'Reduced sensation to touch over both soles', category: 'finding', source: 'ai' },
      { text: 'Hypertension improving; peripheral neuropathy, likely age-related', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Telmisartan', dose: '40 mg', frequency: 'OD', duration: '1 month', notes: 'Continue', source: 'manual' },
      { drug: 'Methylcobalamin', dose: '1500 mcg', frequency: 'OD', duration: '1 month', notes: '', source: 'ai' },
    ],
    notes: 'BP better controlled. Starting Methylcobalamin for neuropathic symptoms, review in six weeks.',
    transcript: ['BP down to 140 over 88. Reduced sensation over both soles, starting tab Methylcobalamin for the tingling.'],
  },
  {
    mrn: 'P-0011', date: '2026-03-22T11:15:00+05:30', durationMin: 14,
    reason: 'Fever for 2 days, now developed rash all over body',
    vitals: { temp: '38.4', pulse: '128', weight: '12', spo2: '98' },
    diagnosis: [
      { text: 'Fever followed by generalised rash', category: 'symptom', source: 'manual' },
      { text: 'Fine maculopapular rash over trunk and limbs, throat mildly congested', category: 'finding', source: 'ai' },
      { text: 'Likely viral exanthem', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Paracetamol', dose: '120 mg/5 ml syrup', frequency: 'TDS', duration: '3 days', notes: 'If fever above 100 F', source: 'manual' },
    ],
    notes: 'Advised plenty of fluids, sponging for fever. Return if fever persists beyond 3 days or rash worsens.',
    transcript: ['Fine maculopapular rash over trunk, likely viral exanthem. Paracetamol syrup for fever only, no antibiotics needed.'],
  },
  {
    mrn: 'P-0011', date: '2026-03-29T10:30:00+05:30', durationMin: 10,
    reason: 'Follow-up, fever settled, rash fading',
    vitals: { temp: '36.9', pulse: '108', weight: '12', spo2: '99' },
    diagnosis: [
      { text: 'No fever since 3 days, rash fading', category: 'symptom', source: 'manual' },
      { text: 'Rash much lighter, child active and playful', category: 'finding', source: 'ai' },
      { text: 'Resolved viral exanthem', category: 'assessment', source: 'manual' },
    ],
    prescription: [],
    notes: 'Full recovery, no further medication needed.',
    transcript: ['Rash has faded and child is active and afebrile. No further treatment needed.'],
  },
  {
    mrn: 'P-0012', date: '2026-02-18T17:00:00+05:30', durationMin: 15,
    reason: 'Recurrent one-sided headaches for 3 months, 3-4 episodes a month',
    vitals: { bp: '124/80', temp: '36.7', pulse: '76', weight: '74', spo2: '98' },
    diagnosis: [
      { text: 'Throbbing one-sided headache with nausea, lasting hours', category: 'symptom', source: 'manual' },
      { text: 'Neurological examination normal, no focal deficits', category: 'finding', source: 'ai' },
      { text: 'Migraine without aura', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Sumatriptan', dose: '50 mg', frequency: 'SOS', duration: '10 days', notes: 'At onset of headache', source: 'manual' },
      { drug: 'Flunarizine', dose: '10 mg', frequency: 'HS', duration: '1 month', notes: 'For prevention', source: 'ai' },
    ],
    notes: 'Advised headache diary, adequate sleep and hydration, avoid known triggers.',
    transcript: ['Neurological exam is normal. This looks like migraine without aura. Starting Sumatriptan for acute attacks and Flunarizine at night for prevention.'],
  },
  {
    mrn: 'P-0012', date: '2026-05-25T17:30:00+05:30', durationMin: 12,
    reason: 'Follow-up for migraine, fewer episodes',
    vitals: { bp: '120/78', temp: '36.6', pulse: '74', weight: '74', spo2: '98' },
    diagnosis: [
      { text: 'Headache frequency reduced to once a month', category: 'symptom', source: 'manual' },
      { text: 'Neurological examination remains normal', category: 'finding', source: 'ai' },
      { text: 'Migraine without aura, well controlled on prophylaxis', category: 'assessment', source: 'manual' },
    ],
    prescription: [
      { drug: 'Flunarizine', dose: '10 mg', frequency: 'HS', duration: '1 month', notes: 'Continue', source: 'manual' },
    ],
    notes: 'Good response to prophylaxis. Continue Flunarizine, review after two months.',
    transcript: ['Only one episode this month, much improved. Continue Flunarizine nightly.'],
  },
]

async function main() {
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  if (RESET) {
    await db.collection('patients').deleteMany({})
    await db.collection('visits').deleteMany({})
    await db.collection('counters').deleteMany({})
    console.log('Reset: cleared patients, visits, counters.')
  }

  await db.collection('users').createIndex({ username: 1 }, { unique: true })
  await db.collection('patients').createIndex({ mrn: 1 }, { unique: true })
  await db.collection('patients').createIndex({ name: 1 })
  await db.collection('visits').createIndex({ status: 1 })
  await db.collection('visits').createIndex({ createdAt: 1 })

  const admin = await upsertUser(db, 'admin', 'admin123', 'Administrator', 'admin')
  const doctor = await upsertUser(db, 'dr.rao', 'doctor123', 'Dr. S. Rao', 'doctor', 'General Medicine')
  const reception = await upsertUser(db, 'reception', 'recep123', 'Reception Desk', 'reception')

  if (!admin || !doctor || !reception) throw new Error('failed to seed users')

  // a patient must exist before their earliest visit — registering everyone "today"
  // would show a 2025 visit on a patient registered this morning
  const firstVisit: Record<string, number> = {}
  for (const v of visitSpecs) {
    const t = new Date(v.date).getTime()
    if (!firstVisit[v.mrn] || t < firstVisit[v.mrn]) firstVisit[v.mrn] = t
  }

  const byMrn: Record<string, { _id: unknown }> = {}
  for (const p of patients) {
    const { mrn, ...data } = p
    const registeredAt = firstVisit[mrn]
      ? new Date(firstVisit[mrn] - 1000 * 60 * 60 * 24 * 11)
      : new Date()
    const doc = await upsertPatient(db, mrn, data, String(reception._id), registeredAt)
    if (!doc) throw new Error(`failed to seed patient ${mrn}`)
    byMrn[mrn] = doc
  }

  await db.collection('counters').updateOne({ _id: 'mrn' as unknown as never }, { $max: { seq: 12 } }, { upsert: true })

  for (const spec of visitSpecs) {
    const patientId = String(byMrn[spec.mrn]._id)
    const startedAt = new Date(spec.date)
    const completedAt = new Date(startedAt.getTime() + spec.durationMin * 60000)
    const exists = await db.collection('visits').findOne({ patientId, startedAt })
    if (exists) continue

    let t = 0
    const nextAt = () => new Date(startedAt.getTime() + Math.min(t++, spec.durationMin - 1) * 60000)

    const diagnosis: DiagnosisItem[] = spec.diagnosis.map((d) => ({
      id: crypto.randomUUID(),
      text: d.text,
      category: d.category,
      source: d.source,
      at: nextAt() as unknown as string,
    }))
    const prescription: PrescriptionItem[] = spec.prescription.map((r) => ({
      id: crypto.randomUUID(),
      drug: r.drug,
      dose: r.dose,
      frequency: r.frequency,
      duration: r.duration,
      notes: r.notes,
      source: r.source,
      at: nextAt() as unknown as string,
    }))
    const transcript = spec.transcript.map((text) => ({
      id: crypto.randomUUID(),
      text,
      at: nextAt() as unknown as string,
    }))

    await db.collection('visits').insertOne({
      patientId,
      doctorId: String(doctor._id),
      status: 'completed',
      reason: spec.reason,
      vitals: spec.vitals,
      diagnosis,
      prescription,
      transcript,
      notes: spec.notes,
      createdBy: String(reception._id),
      createdAt: startedAt,
      startedAt,
      completedAt,
    })
  }

  const todayWaiting: { mrn: string; reason: string; vitals: Vitals }[] = [
    { mrn: 'P-0002', reason: 'Abdominal pain since morning', vitals: { bp: '118/76', temp: '37.1', pulse: '80', weight: '58', spo2: '99' } },
    { mrn: 'P-0003', reason: 'Mild fever since morning', vitals: { temp: '37.8', pulse: '100', weight: '23', spo2: '98' } },
    { mrn: 'P-0005', reason: 'Follow-up for diabetes, brought sugar report', vitals: { bp: '130/84', temp: '36.7', pulse: '80', weight: '77', spo2: '98' } },
  ]

  for (const w of todayWaiting) {
    const patientId = String(byMrn[w.mrn]._id)
    const exists = await db.collection('visits').findOne({ patientId, status: 'waiting' })
    if (exists) continue
    await db.collection('visits').insertOne({
      patientId,
      doctorId: null,
      status: 'waiting',
      reason: w.reason,
      vitals: w.vitals,
      diagnosis: [],
      prescription: [],
      transcript: [],
      notes: '',
      createdBy: String(reception._id),
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    })
  }

  console.log('Seed complete.')
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
