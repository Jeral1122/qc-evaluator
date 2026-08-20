import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReportSchema } from '../lib/scoring/schema.ts'
import { RUBRICS } from '../lib/rubrics/index.ts'
import { makeDraft } from './factory.ts'

/*
 * The schema is the first of two gates. It blocks anything the rubric never offers ANYWHERE,
 * which keeps the compiled grammar small enough for the API to accept. The second gate,
 * verify.ts, catches what is legal in the rubric but illegal for a particular dimension.
 * These tests cover the first gate; verify.test.ts covers the second.
 */

for (const rubric of Object.values(RUBRICS)) {
  const schema = buildReportSchema(rubric)

  test(`${rubric.key}: a well-formed report parses`, () => {
    const result = schema.safeParse(makeDraft(rubric))
    assert.ok(result.success, JSON.stringify(result.error?.issues?.slice(0, 3), null, 2))
  })

  test(`${rubric.key}: a score that appears nowhere in the rubric is rejected`, () => {
    for (const offset of [0.25, 0.5]) {
      const draft = makeDraft(rubric, { scoreFor: (spec) => spec.max + offset })
      assert.equal(schema.safeParse(draft).success, false, `accepted max + ${offset}`)
    }
  })

  test(`${rubric.key}: every dimension may return null, and verify.ts decides if that was allowed`, () => {
    // The grammar cannot vary the score type per dimension, so nullability is uniform here.
    // Whether a null was legitimate is a per-dimension question, answered in verify.ts.
    const draft = makeDraft(rubric, { scoreFor: () => null })
    assert.ok(schema.safeParse(draft).success)
  })

  test(`${rubric.key}: all twelve dimensions must be present`, () => {
    const draft = makeDraft(rubric)
    draft.dimensions = draft.dimensions.slice(0, 11)
    // The schema does not count them; it only types them. Length is verify.ts's job.
    assert.ok(schema.safeParse(draft).success)
  })
}

test('the two rubrics have different score vocabularies', () => {
  // 8 is a real kick-off score, sitting inside D1's Strong band of 6-8.
  const k = makeDraft(RUBRICS.kickoff, { scoreFor: () => 8 })
  assert.ok(buildReportSchema(RUBRICS.kickoff).safeParse(k).success)

  // Coaching offers 15, 10, 7, 5, 3 and 0 across the whole rubric. 8 is not among them.
  const c = makeDraft(RUBRICS.coaching, { scoreFor: () => 8 })
  assert.equal(buildReportSchema(RUBRICS.coaching).safeParse(c).success, false)
})

test('an unknown cap id is rejected', () => {
  const schema = buildReportSchema(RUBRICS.coaching)

  const invented = makeDraft(RUBRICS.coaching, {
    capsObserved: [{ id: 'coach-was-rude', why: 'made up' }],
  })
  assert.equal(schema.safeParse(invented).success, false)

  const real = makeDraft(RUBRICS.coaching, {
    capsObserved: [{ id: 'coach-monologue', why: 'coach spoke for most of the call' }],
  })
  assert.ok(schema.safeParse(real).success)
})

test('the one thing must point at a dimension that exists', () => {
  const draft = makeDraft(RUBRICS.kickoff, { ifFixed: { dimension: 'D13', score: 5 } })
  assert.equal(buildReportSchema(RUBRICS.kickoff).safeParse(draft).success, false)
})
