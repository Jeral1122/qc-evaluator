/** Shared builders for the scoring tests. Not a test file itself. */
import type { RubricSpec } from '../lib/rubrics/types.ts'
import { allowedScores } from '../lib/rubrics/index.ts'
import type { ReportDraft } from '../lib/scoring/schema.ts'

/** A short transcript every quote in these tests is drawn from. */
export const TRANSCRIPT = `Coach: morning Renata, how's the foot been this week?
Client: honestly it's been a lot more than just the foot thing.
Coach: so what would it mean to walk without that pain?
Client: everything. I'd get my life back.
Coach: right, let's put the next call in now. Tuesday at three?
Client: that works for me.
Coach: I'll send the recap within ten minutes of hanging up.`

type Opts = {
  /** Score for each dimension. Defaults to the top of its table. */
  scoreFor?: (spec: RubricSpec['dimensions'][number]) => number | null
  evidence?: string[]
  capsObserved?: { id: string; why: string }[]
  disable?: string[]
  ifFixed?: { dimension: string; score: number }
}

export function makeDraft(rubric: RubricSpec, opts: Opts = {}): ReportDraft {
  const {
    scoreFor = (spec) => spec.max,
    evidence = ['that works for me'],
    capsObserved = [],
    disable = [],
    ifFixed,
  } = opts

  const dimensions = rubric.dimensions.map((spec) => {
    const disabled = disable.includes(spec.id)
    return {
      id: spec.id,
      score: disabled ? null : scoreFor(spec),
      reasoning: 'The coach did the thing, at 04:12.',
      evidence: disabled ? [] : evidence,
      quick_fix: 'Ask the follow-up before moving on.',
      not_evidenced: false,
      disabled,
      disabled_reason: disabled ? 'no movement coaching on this call' : null,
    }
  })

  const first = rubric.dimensions[0]
  return {
    one_thing: {
      change: 'Book the next call live.',
      why: 'It is the biggest single predictor of the client coming back.',
      if_fixed: ifFixed ?? { dimension: first.id, score: allowedScores(first)[0] },
    },
    brief: 'A solid call with one gap at the end.',
    red_flags: [],
    caps_observed: capsObserved,
    dimensions,
  } as ReportDraft
}

/** The score in the middle of a dimension's table, for tests that need "not full marks". */
export function midScore(spec: RubricSpec['dimensions'][number]): number {
  const scores = allowedScores(spec)
  return scores[Math.floor(scores.length / 2)]
}
