import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReportSchema } from '../lib/scoring/schema.ts'
import { RUBRICS, allowedScores } from '../lib/rubrics/index.ts'
import type { RubricSpec } from '../lib/rubrics/types.ts'

/** A report that should pass: every dimension scored at its top band, nothing unusual. */
function validDraft(rubric: RubricSpec) {
  const dimensions: Record<string, Record<string, unknown>> = Object.fromEntries(
    rubric.dimensions.map((d) => [
      d.id,
      {
        score: d.max,
        reasoning: 'The coach did the thing, at 04:12.',
        evidence: ['so what actually brought you here'],
        quick_fix: 'Nothing, this was full marks.',
        not_evidenced: false,
        ...(d.optional ? { disabled: false, disabled_reason: null } : {}),
      },
    ]),
  )

  return {
    one_thing: {
      change: 'Book the next call live rather than promising a link.',
      why: 'It is the single biggest predictor of the client coming back.',
      if_fixed: { dimension: 'D1', score: rubric.dimensions[0].max },
    },
    brief: 'A solid call with one gap at the end.',
    red_flags: [] as { flag: string; why: string }[],
    caps_observed: [] as { id: string; why: string }[],
    dimensions,
  }
}

for (const rubric of Object.values(RUBRICS)) {
  test(`${rubric.key}: a well-formed report parses`, () => {
    const result = buildReportSchema(rubric).safeParse(validDraft(rubric))
    assert.ok(result.success, JSON.stringify(result.error?.issues?.slice(0, 3), null, 2))
  })

  test(`${rubric.key}: a score the rubric does not offer is rejected`, () => {
    const schema = buildReportSchema(rubric)
    for (const dimension of rubric.dimensions) {
      const permitted = allowedScores(dimension)
      // Half a point above the top band is never a legal score in either rubric.
      const illegal = dimension.max + 0.5
      assert.ok(!permitted.includes(illegal))

      const draft = validDraft(rubric)
      draft.dimensions[dimension.id].score = illegal
      assert.equal(
        schema.safeParse(draft).success,
        false,
        `${rubric.key} ${dimension.id} accepted ${illegal}, which is not in its table`,
      )
    }
  })

  test(`${rubric.key}: only the optional dimension may score null`, () => {
    const schema = buildReportSchema(rubric)
    for (const dimension of rubric.dimensions) {
      const draft = validDraft(rubric)
      draft.dimensions[dimension.id].score = null
      assert.equal(
        schema.safeParse(draft).success,
        Boolean(dimension.optional),
        `${rubric.key} ${dimension.id}: null should be ${dimension.optional ? 'allowed' : 'rejected'}`,
      )
    }
  })
}

test('coaching forbids the in-between scores that kickoff allows', () => {
  // Kick-off D1 runs 0 to 10 with no holes. Coaching D1 offers 10, 7, 3, 0 and nothing else.
  const kickoff = buildReportSchema(RUBRICS.kickoff)
  const coaching = buildReportSchema(RUBRICS.coaching)

  const k = validDraft(RUBRICS.kickoff)
  k.dimensions.D1.score = 8
  assert.ok(kickoff.safeParse(k).success, 'kickoff D1 should accept 8, it sits in the Strong band')

  const c = validDraft(RUBRICS.coaching)
  c.dimensions.D1.score = 8
  assert.equal(coaching.safeParse(c).success, false, 'coaching D1 should reject 8')
})

test('the gap in kickoff D3 is closed to the model, not just to us', () => {
  const schema = buildReportSchema(RUBRICS.kickoff)
  const draft = validDraft(RUBRICS.kickoff)

  draft.dimensions.D3.score = 4 // sits between Mid (2.5-3.5) and Elite (4.5-5)
  assert.equal(schema.safeParse(draft).success, false, '4 belongs to no band and must be rejected')

  draft.dimensions.D3.score = 3.5
  assert.ok(schema.safeParse(draft).success, '3.5 is the top of Mid and is legal')
})

test('an unknown cap id is rejected', () => {
  const draft = validDraft(RUBRICS.coaching)
  draft.caps_observed = [{ id: 'coach-was-rude', why: 'made up' }]
  assert.equal(buildReportSchema(RUBRICS.coaching).safeParse(draft).success, false)

  draft.caps_observed = [{ id: 'coach-monologue', why: 'coach spoke for most of the call' }]
  assert.ok(buildReportSchema(RUBRICS.coaching).safeParse(draft).success)
})
