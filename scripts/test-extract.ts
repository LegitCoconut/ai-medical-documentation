import assert from 'node:assert/strict'
import { matchDrug } from '../lib/drugs'
import { extractRules } from '../lib/extract'
import type { DiagnosisItem, PrescriptionItem, Vitals } from '../lib/types'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`✓ ${name}`)
}

const empty = {
  diagnosis: [] as DiagnosisItem[],
  prescription: [] as PrescriptionItem[],
  vitals: {} as Vitals,
}

check('amoxicillin full line: dose/freq/duration/notes', () => {
  const r = extractRules('Tab Amoxicillin 500 mg TDS for 5 days after food', empty)
  assert.equal(r.prescription.length, 1)
  const rx = r.prescription[0]
  assert.equal(rx.drug, 'Amoxicillin')
  assert.equal(rx.dose, '500 mg')
  assert.equal(rx.frequency, 'TDS')
  assert.equal(rx.duration, '5 days')
  assert.ok(rx.notes.includes('after food'))
})

check('spoken frequency + worded duration, unitless dose', () => {
  const r = extractRules('give paracetamol 650 twice a day for three days', empty)
  assert.equal(r.prescription.length, 1)
  const rx = r.prescription[0]
  assert.equal(rx.drug, 'Paracetamol')
  assert.equal(rx.dose, '650')
  assert.equal(rx.frequency, 'BD')
  assert.equal(rx.duration, '3 days')
})

check('mis-heard drug name fuzzy-matches Cefixime', () => {
  const r = extractRules('Sefixime 200 mg BD x 5 days', empty)
  assert.equal(r.prescription.length, 1)
  assert.equal(r.prescription[0].drug, 'Cefixime')
  assert.equal(r.prescription[0].dose, '200 mg')
  assert.equal(r.prescription[0].frequency, 'BD')
  assert.equal(r.prescription[0].duration, '5 days')
})

check('pantoprazole once daily before food', () => {
  const r = extractRules('Pantoprazole 40 mg once daily before food', empty)
  assert.equal(r.prescription.length, 1)
  const rx = r.prescription[0]
  assert.equal(rx.drug, 'Pantoprazole')
  assert.equal(rx.frequency, 'OD')
  assert.ok(rx.notes.includes('before food'))
})

check('numeric frequency 1-0-1', () => {
  const r = extractRules('Tab Ibuprofen 400 mg 1-0-1 for 5 days', empty)
  assert.equal(r.prescription.length, 1)
  assert.equal(r.prescription[0].frequency, '1-0-1')
})

check('numeric frequency 0-0-1', () => {
  const r = extractRules('Tab Domperidone 10 mg 0-0-1 for 5 days', empty)
  assert.equal(r.prescription.length, 1)
  assert.equal(r.prescription[0].frequency, '0-0-1')
})

check('finding category from auscultation', () => {
  const r = extractRules('Chest is clear on auscultation, no added sounds', empty)
  assert.equal(r.diagnosis.length, 1)
  assert.equal(r.diagnosis[0].category, 'finding')
})

check('symptom category from complaint', () => {
  const r = extractRules('Patient complains of cough since three days', empty)
  assert.equal(r.diagnosis.length, 1)
  assert.equal(r.diagnosis[0].category, 'symptom')
})

check('assessment category from "likely"', () => {
  const r = extractRules('Likely viral upper respiratory infection', empty)
  assert.equal(r.diagnosis.length, 1)
  assert.equal(r.diagnosis[0].category, 'assessment')
})

check('filler sentences produce nothing', () => {
  const r1 = extractRules('okay', empty)
  assert.equal(r1.diagnosis.length, 0)
  assert.equal(r1.prescription.length, 0)
  const r2 = extractRules('hmm let me see', empty)
  assert.equal(r2.diagnosis.length, 0)
  assert.equal(r2.prescription.length, 0)
})

check('one chunk with a drug sentence and a finding sentence yields one rx and one dx', () => {
  const r = extractRules('Chest is clear on auscultation. Tab Azithromycin 500 mg OD for 3 days.', empty)
  assert.equal(r.diagnosis.length, 1)
  assert.equal(r.diagnosis[0].category, 'finding')
  assert.equal(r.prescription.length, 1)
  assert.equal(r.prescription[0].drug, 'Azithromycin')
})

check('plain symptom sentences never produce a phantom prescription', () => {
  // regression: "and" matched a sub-token of "Iron and Folic Acid" at score 1.0
  for (const line of [
    'Patient complains of fever and cough since three days.',
    'He has body ache and weakness with loose motions.',
    'No history of diabetes or hypertension in the family.',
  ]) {
    const r = extractRules(line, empty)
    assert.equal(r.prescription.length, 0, `phantom rx from: ${line}`)
    assert.equal(r.diagnosis.length, 1, `expected one dx from: ${line}`)
  }
})

check('stopwords and dosage units never match a drug', () => {
  for (const w of ['and', 'with', 'tab', 'the', 'for', 'acid', 'mg', 'od', 'bd'])
    assert.equal(matchDrug(w), null, `${w} should not match a drug`)
  assert.equal(matchDrug('ORS')?.drug, 'ORS')      // short exact match still works
  assert.equal(matchDrug('Sefixime')?.drug, 'Cefixime')
})

check('a spoken correction updates the existing line, it is not dropped', () => {
  const first = extractRules('Tab Cefixime 200 mg BD for 5 days.', empty)
  assert.equal(first.prescription.length, 1)
  assert.equal(first.prescription[0].dose, '200 mg')
  const id = first.prescription[0].id

  const corrected = extractRules('Make that Cefixime 400 mg.', first)
  assert.equal(corrected.prescription.length, 1, 'correction must come through, not add a new line')
  assert.equal(corrected.prescription[0].id, id, 'must update the same line, not add a new one')
  assert.equal(corrected.prescription[0].dose, '400 mg')
  // fields the doctor did not restate survive
  assert.equal(corrected.prescription[0].frequency, 'BD')
  assert.equal(corrected.prescription[0].duration, '5 days')
})

// adapted for the new full-merged-state contract: extractRules now returns the complete
// state (existing + new), not a delta, so a repeat mention keeps exactly one row untouched
// rather than emitting zero new rows.
check('dedup: same sentence twice against existing state adds no duplicate', () => {
  const first = extractRules('Chest is clear on auscultation', empty)
  assert.equal(first.diagnosis.length, 1)
  const second = extractRules('Chest is clear on auscultation', first)
  assert.equal(second.diagnosis.length, 1, 'must not duplicate the existing line')
  assert.equal(second.diagnosis[0].id, first.diagnosis[0].id)
  assert.equal(second.prescription.length, 0)
})

check('restating a drug with nothing new leaves the line untouched', () => {
  const first = extractRules('Tab Azithromycin 500 mg OD for 3 days.', empty)
  const again = extractRules('Azithromycin 500 mg OD for 3 days.', first)
  assert.equal(again.prescription.length, 1, 'still one row, not dropped and not duplicated')
  assert.equal(again.prescription[0].id, first.prescription[0].id)
  assert.equal(again.prescription[0].at, first.prescription[0].at, 'no spurious update when nothing changed')
})

// --- vitals ---

check('a pure vitals sentence populates vitals only, not a diagnosis line', () => {
  const r = extractRules('Temperature is 38.4 degrees celsius', empty)
  assert.equal(r.vitals.temp, '38.4')
  assert.equal(r.diagnosis.length, 0, 'a bare vitals reading must not also become a diagnosis line')
})

check('multi-sentence single pass: 2 medicines + 2 findings + vitals', () => {
  const transcript = [
    'Chest is clear on auscultation.',
    'Patient complains of headache since two days.',
    'Tab Amoxicillin 500 mg TDS for 5 days.',
    'Cefixime 200 mg BD for 5 days.',
    'BP is 120 over 80, temperature 38.4.',
  ].join(' ')
  const r = extractRules(transcript, empty)
  assert.equal(r.diagnosis.length, 2)
  assert.equal(r.prescription.length, 2)
  assert.deepEqual(r.prescription.map((p) => p.drug).sort(), ['Amoxicillin', 'Cefixime'])
  assert.equal(r.vitals.bp, '120/80')
  assert.equal(r.vitals.temp, '38.4')
})

check('all four spoken vitals populate without becoming four diagnosis lines', () => {
  const r = extractRules('BP is 120 over 80, temperature 38.4, pulse 92, spo2 97', empty)
  assert.equal(r.vitals.bp, '120/80')
  assert.equal(r.vitals.temp, '38.4')
  assert.equal(r.vitals.pulse, '92')
  assert.equal(r.vitals.spo2, '97')
  assert.equal(r.diagnosis.length, 0, 'must not produce four diagnosis lines')
})

check('self-correction across a long transcript keeps one line with the corrected dose', () => {
  const transcript = [
    'Patient complains of fever and cough since three days.',
    'Chest is clear on auscultation.',
    'Start Tab Cefixime 200 mg BD for 5 days.',
    'Also advise plenty of fluids and rest.',
    'Actually make that Cefixime 400 mg.',
  ].join(' ')
  const r = extractRules(transcript, empty)
  const cef = r.prescription.filter((p) => p.drug === 'Cefixime')
  assert.equal(cef.length, 1, 'must not create a second line for the correction')
  assert.equal(cef[0].dose, '400 mg')
  assert.equal(cef[0].frequency, 'BD', 'frequency not restated in the correction must survive')
})

check('vitals merge: existing bp is preserved, a new temperature is added', () => {
  const r = extractRules('Temperature is 38.4', { ...empty, vitals: { bp: '110/70' } })
  assert.equal(r.vitals.bp, '110/70')
  assert.equal(r.vitals.temp, '38.4')
})

check('an out-of-range vital reading is rejected, not stored', () => {
  const r = extractRules('Pulse is 900', empty)
  assert.equal(r.vitals.pulse, '', 'a pulse of 900 is physiologically impossible and must be rejected')
})

check('an assessment marker outranks an incidental symptom word', () => {
  const r = extractRules('Likely viral fever.', empty)
  assert.equal(r.diagnosis.length, 1)
  assert.equal(r.diagnosis[0].category, 'assessment')
  const r2 = extractRules('Patient complains of fever since two days.', empty)
  assert.equal(r2.diagnosis[0].category, 'symptom', 'a plain symptom must stay a symptom')
})

console.log(`\n${passed} passed`)
