import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RUBRICS } from '../lib/rubrics/index.ts'
import { computeScoring } from '../lib/scoring/total.ts'
import { verifyDraft } from '../lib/scoring/verify.ts'
import { makeDraft, TRANSCRIPT } from './factory.ts'
import type { RubricSpec } from '../lib/rubrics/types.ts'

const kickoff = RUBRICS.kickoff
const coaching = RUBRICS.coaching

/** Build, verify and score in one step, the way the real pipeline does it. */
function score(rubric: RubricSpec, opts: Parameters<typeof makeDraft>[1] = {}) {
  return computeScoring(rubric, verifyDraft(rubric, TRANSCRIPT, makeDraft(rubric, opts)))
}

/** Give these dimensions full marks and everything else zero. */
function only(ids: string[]) {
  return (spec: RubricSpec['dimensions'][number]) => (ids.includes(spec.id) ? spec.max : 0)
}

/* ---- the fraction ---- */

test('a perfect kick-off call is 100', () => {
  const s = score(kickoff)
  assert.equal(s.raw, 100)
  assert.equal(s.denominator, 100)
  assert.equal(s.percent, 100)
  assert.equal(s.band, 'Elite')
})

test('coaching is normalised, because its maximums sum to 105 and not 100', () => {
  const s = score(coaching)
  assert.equal(s.raw, 105)
  assert.equal(s.denominator, 105)
  // The whole reason for deriving the denominator instead of trusting the rubric's prose:
  // a perfect call scores 100, not 105.
  assert.equal(s.percent, 100)
  assert.equal(s.band, 'Elite')
})

test('a call that scores nothing is 0 and Fail, not a crash', () => {
  const s = score(kickoff, { scoreFor: () => 0, evidence: [] })
  assert.equal(s.percent, 0)
  assert.equal(s.band, 'Fail')
})

/* ---- conditional dimensions leave both sides ---- */

test('a disabled dimension is removed from the denominator, not scored zero', () => {
  const s = score(coaching, { disable: ['D4'] })
  assert.equal(s.denominator, 90, '105 minus D4 which is worth 15')
  assert.equal(s.raw, 90)
  assert.equal(s.percent, 100, 'a perfect call is still perfect with a dimension switched off')
  assert.equal(s.dimensions.find((d) => d.id === 'D4')!.score, null)
})

test('both conditional dimensions can be off at once', () => {
  const s = score(coaching, { disable: ['D2', 'D4'] })
  assert.equal(s.denominator, 80, '105 minus D2 which is 10 and D4 which is 15')
})

test('dropping a dimension redistributes its weight across the survivors', () => {
  // The rubric says D2's weight goes "to D3 and D4". Removing it from the denominator does the
  // same job proportionally: an otherwise identical call is not punished for the missing
  // dimension, and every surviving dimension is worth more of the total.
  const withD2 = score(coaching, { scoreFor: only(['D1', 'D3']) })
  const withoutD2 = score(coaching, { scoreFor: only(['D1', 'D3']), disable: ['D2'] })
  assert.ok(withoutD2.percent > withD2.percent, 'the same performance should score higher')
  assert.equal(withD2.percent, Math.round((25 / 105) * 100))
  assert.equal(withoutD2.percent, Math.round((25 / 95) * 100))
})

/* ---- caps ---- */

test('a dimension cap clamps that dimension before anything is added up', () => {
  const s = score(coaching, {
    capsObserved: [{ id: 'next-call-not-booked', why: 'the call ended with a link promised' }],
  })
  const d10 = s.dimensions.find((d) => d.id === 'D10')!
  assert.equal(d10.score, 0, 'the rubric calls this one non-recoverable')
  assert.equal(d10.scoreBeforeCap, 5)
  assert.equal(d10.cappedBy, 'next-call-not-booked')
  assert.equal(s.raw, 100, '105 minus the 5 D10 lost')
})

test('a total cap clamps the percentage after the fraction', () => {
  const s = score(coaching, {
    capsObserved: [{ id: 'coach-monologue', why: 'the coach spoke for most of the call' }],
  })
  assert.equal(s.raw, 105, 'the dimensions themselves are untouched')
  assert.equal(s.percent, 75, 'but the call is held at 75')
  assert.equal(s.band, 'Inconsistent')
})

test('when two total caps fire, the lower ceiling wins', () => {
  const s = score(coaching, {
    capsObserved: [
      { id: 'coach-monologue', why: 'monologue' },
      { id: 'no-action-steps', why: 'nothing was agreed before the close' },
    ],
  })
  assert.equal(s.percent, 70, 'the 70 ceiling beats the 75 one')
})

test('a cap that was true but cost nothing says so', () => {
  // The condition held, but the call was already scoring below the ceiling. Telling a coach
  // a cap cost them points it did not cost them would be a lie.
  const s = score(coaching, {
    scoreFor: only(['D1']),
    capsObserved: [{ id: 'coach-monologue', why: 'monologue' }],
  })
  const cap = s.capsFired.find((c) => c.id === 'coach-monologue')!
  assert.equal(cap.changedTheOutcome, false)
  assert.ok(s.percent < 75)
})

test('a cap that did cost points also says so', () => {
  const s = score(coaching, { capsObserved: [{ id: 'coach-monologue', why: 'monologue' }] })
  assert.equal(s.capsFired.find((c) => c.id === 'coach-monologue')!.changedTheOutcome, true)
})

/* ---- bands ---- */

test('the band boundary is inclusive, so exactly 70 is Inconsistent', () => {
  // 10 + 10 + 5 + 15 + 10 + 10 + 10 = 70 out of kick-off's 100.
  const s = score(kickoff, { scoreFor: only(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D8']) })
  assert.equal(s.percent, 70)
  assert.equal(s.band, 'Inconsistent')
})

test('a lower total drops a band', () => {
  // 10 + 10 + 15 + 10 + 10 + 10 = 65.
  const s = score(kickoff, { scoreFor: only(['D1', 'D2', 'D4', 'D5', 'D6', 'D8']) })
  assert.equal(s.percent, 65)
  assert.equal(s.band, 'At risk')
})

/* ---- the counterfactual ---- */

test('the projected score is recomputed, never taken from the model', () => {
  const s = score(kickoff, {
    scoreFor: (spec) => (spec.id === 'D10' ? 0 : spec.max),
    ifFixed: { dimension: 'D10', score: 5 },
  })
  assert.equal(s.percent, 95, '100 minus the 5 D10 did not earn')
  assert.equal(s.projected?.percent, 100)
  assert.equal(s.projected?.band, 'Elite')
})

test('no projection is shown when the fix would not move the number', () => {
  const s = score(kickoff) // already full marks everywhere
  assert.equal(s.projected, null)
})

test('a projection cannot break through a total cap', () => {
  const s = score(coaching, {
    scoreFor: (spec) => (spec.id === 'D9' ? 0 : spec.max),
    ifFixed: { dimension: 'D9', score: 5 },
    capsObserved: [{ id: 'coach-monologue', why: 'monologue' }],
  })
  assert.equal(s.percent, 75)
  assert.equal(s.projected, null, 'fixing D9 cannot lift a call above its ceiling')
})
