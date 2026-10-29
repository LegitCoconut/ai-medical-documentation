// Field-level accuracy + latency of the rules pass on a labelled set of dictated lines.
// Usage: pnpm tsx scripts/eval-extract.ts
import { extractRules } from '../lib/extract'
import { matchDrug } from '../lib/drugs'
import type { DiagnosisItem, PrescriptionItem, Vitals } from '../lib/types'

const empty = { diagnosis: [] as DiagnosisItem[], prescription: [] as PrescriptionItem[], vitals: {} as Vitals }

type Rx = { text: string; drug: string; dose: string; frequency: string; duration: string }
const RX: Rx[] = [
  ['Tab Amoxicillin 500 mg TDS for 5 days after food', 'Amoxicillin', '500 mg', 'TDS', '5 days'],
  ['Give paracetamol 650 mg twice a day for three days', 'Paracetamol', '650 mg', 'BD', '3 days'],
  ['Cefixime 200 mg BD x 5 days', 'Cefixime', '200 mg', 'BD', '5 days'],
  ['Pantoprazole 40 mg once daily before food', 'Pantoprazole', '40 mg', 'OD', ''],
  ['Tab Ibuprofen 400 mg 1-0-1 for 5 days', 'Ibuprofen', '400 mg', '1-0-1', '5 days'],
  ['Tab Domperidone 10 mg 0-0-1 for 5 days', 'Domperidone', '10 mg', '0-0-1', '5 days'],
  ['Azithromycin 500 mg OD for 3 days', 'Azithromycin', '500 mg', 'OD', '3 days'],
  ['Metformin 500 mg BD for 30 days', 'Metformin', '500 mg', 'BD', '30 days'],
  ['Amlodipine 5 mg once a day for 30 days', 'Amlodipine', '5 mg', 'OD', '30 days'],
  ['Cetirizine 10 mg at night for 5 days', 'Cetirizine', '10 mg', 'HS', '5 days'],
  ['Ciprofloxacin 500 mg BD for 7 days', 'Ciprofloxacin', '500 mg', 'BD', '7 days'],
  ['Metronidazole 400 mg TDS for 5 days after food', 'Metronidazole', '400 mg', 'TDS', '5 days'],
  ['Doxycycline 100 mg twice daily for 7 days', 'Doxycycline', '100 mg', 'BD', '7 days'],
  ['Salbutamol 2 mg thrice a day for 5 days', 'Salbutamol', '2 mg', 'TDS', '5 days'],
  ['Prednisolone 10 mg once daily for two weeks', 'Prednisolone', '10 mg', 'OD', '2 weeks'],
  ['Atorvastatin 10 mg at bedtime for 30 days', 'Atorvastatin', '10 mg', 'HS', '30 days'],
  ['Losartan 50 mg OD for 30 days', 'Losartan', '50 mg', 'OD', '30 days'],
  ['Levofloxacin 500 mg once a day for 5 days', 'Levofloxacin', '500 mg', 'OD', '5 days'],
  ['Diclofenac 50 mg BD for 3 days after food', 'Diclofenac', '50 mg', 'BD', '3 days'],
  ['Ranitidine 150 mg twice a day for ten days', 'Ranitidine', '150 mg', 'BD', '10 days'],
].map(([text, drug, dose, frequency, duration]) => ({ text, drug, dose, frequency, duration }))

// simulated ASR drug-name errors (phonetic substitutions / dropped letters)
const MISHEARD: [string, string][] = [
  ['Sefixime 200 mg BD for 5 days', 'Cefixime'], ['Amoxicilin 500 mg TDS for 5 days', 'Amoxicillin'],
  ['Pantoprazol 40 mg OD', 'Pantoprazole'], ['Azithromycine 500 mg OD for 3 days', 'Azithromycin'],
  ['Metformine 500 mg BD', 'Metformin'], ['Cetrizine 10 mg HS', 'Cetirizine'],
  ['Ciprofloxacine 500 mg BD for 7 days', 'Ciprofloxacin'], ['Doxycyclin 100 mg BD for 7 days', 'Doxycycline'],
  ['Paracetamole 650 mg BD', 'Paracetamol'], ['Ibuprofin 400 mg 1-0-1', 'Ibuprofen'],
  ['Amlodipin 5 mg OD', 'Amlodipine'], ['Metronidazol 400 mg TDS', 'Metronidazole'],
  ['Prednisolon 10 mg OD', 'Prednisolone'], ['Atorvastatine 10 mg HS', 'Atorvastatin'],
  ['Diclofenak 50 mg BD', 'Diclofenac'],
]

const fields = ['drug', 'dose', 'frequency', 'duration'] as const
const hit: Record<string, number> = { drug: 0, dose: 0, frequency: 0, duration: 0 }
let full = 0
for (const c of RX) {
  const rx = extractRules(c.text, empty).prescription[0]
  let all = true
  for (const f of fields) {
    const ok = !!rx && (rx as unknown as Record<string, string>)[f] === c[f]
    if (ok) hit[f]++; else { all = false; console.log(`  miss [${f}] "${c.text}" -> ${rx ? (rx as unknown as Record<string, string>)[f] : 'no rx'}`) }
  }
  if (all) full++
}
console.log(`\nRX lines: ${RX.length}`)
for (const f of fields) console.log(`${f.padEnd(10)} ${hit[f]}/${RX.length} = ${(100 * hit[f] / RX.length).toFixed(1)}%`)
console.log(`all four fields correct: ${full}/${RX.length} = ${(100 * full / RX.length).toFixed(1)}%`)

let mh = 0
for (const [text, want] of MISHEARD) {
  const got = extractRules(text, empty).prescription[0]?.drug
  if (got === want) mh++; else console.log(`  miss misheard "${text}" -> ${got}`)
}
console.log(`\nmisheard-name recovery: ${mh}/${MISHEARD.length} = ${(100 * mh / MISHEARD.length).toFixed(1)}%`)

// non-drug sentences must never create a prescription line (false-positive rate)
const NEG = [
  'Patient complains of fever and cough since three days.', 'Chest is clear on auscultation, no added sounds.',
  'He has body ache and weakness with loose motions.', 'No history of diabetes or hypertension in the family.',
  'Abdomen is soft and non tender.', 'Throat is congested with mild tonsillar enlargement.',
  'Advise plenty of fluids and rest.', 'Likely viral upper respiratory infection.',
  'Review after one week if symptoms persist.', 'The child has been vomiting since yesterday.',
]
const fp = NEG.filter((t) => extractRules(t, empty).prescription.length > 0).length
console.log(`false-positive rx lines on ${NEG.length} non-drug sentences: ${fp}`)

// vitals
const V: [string, Partial<Vitals>][] = [
  ['BP is 120 over 80', { bp: '120/80' }], ['Temperature is 38.4 degrees celsius', { temp: '38.4' }],
  ['Pulse 92', { pulse: '92' }], ['SpO2 97', { spo2: '97' }], ['Weight 64 kg', { weight: '64' }],
  ['BP 140/90, pulse 88, spo2 96', { bp: '140/90', pulse: '88', spo2: '96' }], ['Pulse is 900', { pulse: '' }],
  ['Temp 101.2 F', { temp: '101.2 F' }],
]
let vOk = 0, vTot = 0
for (const [t, want] of V) {
  const got = extractRules(t, empty).vitals as Record<string, string>
  for (const [k, v] of Object.entries(want)) { vTot++; if ((got[k] ?? '') === v) vOk++; else console.log(`  miss vital ${k} "${t}" -> ${got[k]}`) }
}
console.log(`vitals fields: ${vOk}/${vTot} = ${(100 * vOk / vTot).toFixed(1)}%`)

// latency on a long consult
const long = [
  'Patient complains of fever and cough since three days.', 'Chest is clear on auscultation.',
  'BP is 120 over 80, temperature 38.4, pulse 92, spo2 97.', 'Tab Amoxicillin 500 mg TDS for 5 days after food.',
  'Cefixime 200 mg BD for 5 days.', 'Tab Paracetamol 650 mg SOS.', 'Advise plenty of fluids and rest.', 'Likely viral fever.',
].join(' ')
for (let i = 0; i < 20; i++) extractRules(long, empty) // warm-up
const N = 300, t0 = performance.now()
for (let i = 0; i < N; i++) extractRules(long, empty)
console.log(`\nrules pass latency, ${long.split(/\s+/).length}-word consult: ${((performance.now() - t0) / N).toFixed(2)} ms/transcript (mean of ${N})`)
const m0 = performance.now(); for (let i = 0; i < 200; i++) matchDrug('Sefixime'); console.log(`matchDrug latency: ${((performance.now() - m0) / 200).toFixed(3)} ms/call`)

// harder, less regular phrasings — what the rules pass is NOT expected to get (LLM / doctor review leg)
const HARD: Rx[] = [
  ['Give amoxicillin five hundred milligrams three times a day for five days', 'Amoxicillin', '500 mg', 'TDS', '5 days'],
  ['Cefixime 200 twice a day for about a week', 'Cefixime', '200', 'BD', '7 days'],
  ['Paracetamol one tablet every six hours if fever', 'Paracetamol', '1 tablet', 'Q6H', ''],
  ['Start azithromycin 500 milligram daily for three days', 'Azithromycin', '500 mg', 'OD', '3 days'],
  ['Metformin 500 mg morning and night for one month', 'Metformin', '500 mg', 'BD', '1 month'],
  ['Pantoprazole 40 mg empty stomach in the morning for two weeks', 'Pantoprazole', '40 mg', 'OD', '2 weeks'],
  ['Tab Ibuprofen 400 mg three times a day for five days', 'Ibuprofen', '400 mg', 'TDS', '5 days'],
  ['Cetirizine ten milligrams at night', 'Cetirizine', '10 mg', 'HS', ''],
].map(([text, drug, dose, frequency, duration]) => ({ text, drug, dose, frequency, duration }))
const hh: Record<string, number> = { drug: 0, dose: 0, frequency: 0, duration: 0 }
for (const c of HARD) {
  const rx = extractRules(c.text, empty).prescription[0]
  for (const f of fields) if (rx && (rx as unknown as Record<string, string>)[f] === c[f]) hh[f]++
  else console.log(`  hard miss [${f}] "${c.text}" -> ${rx ? (rx as unknown as Record<string, string>)[f] : 'no rx'}`)
}
console.log(`\nHARD set (${HARD.length}): ` + fields.map((f) => `${f} ${hh[f]}/${HARD.length}`).join(', '))
