import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RUBRICS } from '../lib/rubrics/index.ts'
import { verifyDraft, VerificationError } from '../lib/scoring/verify.ts'
import { makeDraft, TRANSCRIPT } from './factory.ts'

const kickoff = RUBRICS.kickoff
const coaching = RUBRICS.coaching

/** Assert the call throws, and that the message actually tells you what went wrong. */
function throwsSaying(fn: () => unknown, fragment: string) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof VerificationError, `expected a VerificationError, got ${error}`)
    assert.ok(
      error.message.toLowerCase().includes(fragment.toLowerCase()),
      `message did not mention "${fragment}":\n  ${error.message}`,
    )
    return true
  })
}

test('a clean draft passes', () => {
  assert.doesNotThrow(() => verifyDraft(kickoff, TRANSCRIPT, makeDraft(kickoff)))
})

/* ---- the check the whole exercise is built around ---- */

test('a quote that is not in the transcript fails the run', () => {
  const draft = makeDraft(kickoff, { evidence: ['I have been a coach for fifteen years'] })
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'not in the transcript')
})

test('the failure names the dimension and shows the quote', () => {
  const draft = makeDraft(kickoff)
  draft.dimensions[4].evidence = ['we can definitely work with that']
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'D5')
})

test('rewrapped whitespace is not fabrication', () => {
  // The same words, broken across lines the way a model might reflow them.
  const draft = makeDraft(kickoff, { evidence: ['so what would it mean\n   to walk without that pain?'] })
  assert.doesNotThrow(() => verifyDraft(kickoff, TRANSCRIPT, draft))
})

test('a curly apostrophe is not fabrication', () => {
  const draft = makeDraft(kickoff, { evidence: ['how’s the foot been this week?'] })
  assert.doesNotThrow(() => verifyDraft(kickoff, TRANSCRIPT, draft))
})

test('changing a word IS fabrication, even by one word', () => {
  const draft = makeDraft(kickoff, { evidence: ['that works well for me'] })
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'not in the transcript')
})

test('an empty quote is rejected', () => {
  const draft = makeDraft(kickoff, { evidence: ['   '] })
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'empty quote')
})

/* ---- credit has to be paid for ---- */

test('a score above the bottom of the table needs a quote behind it', () => {
  const draft = makeDraft(kickoff, { evidence: [] })
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'no evidence')
})

test('the bottom of the table may be scored with no evidence at all', () => {
  // Zero means the coach did not do it. There is nothing to quote, and that is the point.
  const draft = makeDraft(kickoff, { scoreFor: () => 0, evidence: [] })
  assert.doesNotThrow(() => verifyDraft(kickoff, TRANSCRIPT, draft))
})

/* ---- per-dimension score rules the schema could not enforce ---- */

test('a score that is legal elsewhere in the rubric but not on this dimension fails', () => {
  // 10 is a real coaching score, but D7 tops out at 5. The schema lets this through
  // because 10 exists in the rubric; this is the check that catches it.
  const draft = makeDraft(coaching)
  draft.dimensions[6].score = 10
  throwsSaying(() => verifyDraft(coaching, TRANSCRIPT, draft), 'does not offer')
})

test('a value in a band gap fails', () => {
  const draft = makeDraft(kickoff)
  draft.dimensions[2].score = 4 // kickoff D3 jumps from 3.5 to 4.5
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'D3')
})

test('a missing dimension fails and says which', () => {
  const draft = makeDraft(kickoff)
  draft.dimensions = draft.dimensions.filter((d) => d.id !== 'D9')
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'D9')
})

test('the same dimension answered twice fails', () => {
  const draft = makeDraft(kickoff)
  draft.dimensions.push({ ...draft.dimensions[2] })
  throwsSaying(() => verifyDraft(kickoff, TRANSCRIPT, draft), 'more than once')
})

/* ---- the optional dimension ---- */

test('coaching D4 may switch itself off', () => {
  assert.doesNotThrow(() =>
    verifyDraft(coaching, TRANSCRIPT, makeDraft(coaching, { disable: ['D4'] })),
  )
})

test('coaching D2 may switch itself off too, on a non-milestone call', () => {
  assert.doesNotThrow(() =>
    verifyDraft(coaching, TRANSCRIPT, makeDraft(coaching, { disable: ['D2'] })),
  )
})

test('both conditional dimensions may be off at once', () => {
  assert.doesNotThrow(() =>
    verifyDraft(coaching, TRANSCRIPT, makeDraft(coaching, { disable: ['D2', 'D4'] })),
  )
})

test('a dimension that is not conditional may not switch itself off', () => {
  const draft = makeDraft(coaching, { disable: ['D6'] })
  throwsSaying(() => verifyDraft(coaching, TRANSCRIPT, draft), 'not optional')
})

test('disabling without a reason fails', () => {
  const draft = makeDraft(coaching, { disable: ['D4'] })
  draft.dimensions[3].disabled_reason = null
  throwsSaying(() => verifyDraft(coaching, TRANSCRIPT, draft), 'without saying why')
})

test('a null score on a dimension that is not disabled fails', () => {
  const draft = makeDraft(coaching)
  draft.dimensions[5].score = null
  throwsSaying(() => verifyDraft(coaching, TRANSCRIPT, draft), 'no score')
})

/* ---- the counterfactual ---- */

test('the one thing cannot promise a score the dimension cannot reach', () => {
  const draft = makeDraft(coaching, { ifFixed: { dimension: 'D7', score: 15 } })
  throwsSaying(() => verifyDraft(coaching, TRANSCRIPT, draft), 'cannot score')
})

test('the one thing cannot point at a dimension that does not exist', () => {
  const draft = makeDraft(coaching, { ifFixed: { dimension: 'D13', score: 5 } })
  throwsSaying(() => verifyDraft(coaching, TRANSCRIPT, draft), 'does not exist')
})
