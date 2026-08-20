import { bandFor, overallBandFor } from '../rubrics/index.ts'
import type { RubricSpec } from '../rubrics/types.ts'
import type { VerifiedDraft } from './verify.ts'

/**
 * Turning twelve dimension scores into the number on the report.
 *
 * This is not a sum, and the order of operations is the whole point:
 *
 *   1. Dimension caps clamp individual scores.       (a ceiling on one dimension)
 *   2. Disabled dimensions leave BOTH sides.          (not scored, and not counted against)
 *   3. Add up what is left, over what was available.  (raw / denominator)
 *   4. Turn that into a percentage.
 *   5. Total caps clamp the percentage.               (a ceiling on the whole call)
 *   6. The percentage picks the band.
 *
 * Caps clamp at two different moments because they mean two different things. "No North Star
 * statement" limits how well the coach did at goal alignment, so it belongs inside the fraction.
 * "The coach spoke for 75% of the call" is a judgement on the whole call, so it lands on the
 * result. Applying either at the wrong moment gives a different, wrong number.
 *
 * Pure functions, no network, no database. Which is why all of it is testable.
 */

export type CapFired = {
  id: string
  condition: string
  /** The model's sentence on why this condition is true of this call. */
  why: string
  kind: 'total' | 'dimension'
  dimension: string | null
  max: number
  /** False when the condition held but the score was already at or below the ceiling. */
  changedTheOutcome: boolean
}

export type ScoredDimension = {
  id: string
  name: string
  max: number
  score: number | null
  band: string | null
  reasoning: string
  evidence: string[]
  quickFix: string
  notEvidenced: boolean
  disabled: boolean
  disabledReason: string | null
  /** The score before a cap clamped it, when one did. */
  scoreBeforeCap: number | null
  cappedBy: string | null
}

export type Scoring = {
  /** Points earned, before any total cap. */
  raw: number
  /** Points that were available, with disabled dimensions removed. */
  denominator: number
  /** The number on the report, 0 to 100. */
  percent: number
  band: string
  capsFired: CapFired[]
  dimensions: ScoredDimension[]
  /** What the call would have scored if the one thing had been done. */
  projected: { percent: number; band: string } | null
}

/**
 * Round once, at the end.
 *
 * Kick-off allows half points, so a raw total can be 73.5. The bands are whole numbers and the
 * report shows one number, so the number shown and the number banded have to be the same one.
 * Rounding here, once, is what guarantees a report can never say 73 next to a grade that only
 * makes sense for 74.
 */
function toPercent(raw: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((raw / denominator) * 100)
}

export function computeScoring(rubric: RubricSpec, draft: VerifiedDraft): Scoring {
  const byId = new Map(draft.dimensions.map((d) => [d.id, d]))
  const observed = new Map(draft.caps_observed.map((c) => [c.id, c.why]))
  const capsFired: CapFired[] = []

  // ---- 1. Dimension caps ----------------------------------------------------------------
  // Which dimension each observed cap clamps, so the loop below can look it up.
  const dimensionCaps = new Map<string, { id: string; max: number; condition: string; why: string }>()
  for (const cap of rubric.caps) {
    if (cap.kind !== 'dimension' || !observed.has(cap.id)) continue
    dimensionCaps.set(cap.dimension, {
      id: cap.id,
      max: cap.max,
      condition: cap.condition,
      why: observed.get(cap.id)!,
    })
  }

  const dimensions: ScoredDimension[] = rubric.dimensions.map((spec) => {
    const d = byId.get(spec.id)!
    const cap = dimensionCaps.get(spec.id)

    if (d.disabled) {
      return {
        id: spec.id, name: spec.name, max: spec.max,
        score: null, band: null,
        reasoning: d.reasoning, evidence: d.evidence, quickFix: d.quick_fix,
        notEvidenced: d.not_evidenced,
        disabled: true, disabledReason: d.disabled_reason,
        scoreBeforeCap: null, cappedBy: null,
      }
    }

    const original = d.score!
    const capped = cap ? Math.min(original, cap.max) : original
    const wasCapped = capped !== original

    if (cap) {
      capsFired.push({
        id: cap.id, condition: cap.condition, why: cap.why,
        kind: 'dimension', dimension: spec.id, max: cap.max,
        changedTheOutcome: wasCapped,
      })
    }

    return {
      id: spec.id, name: spec.name, max: spec.max,
      score: capped,
      band: bandFor(spec, capped)?.name ?? null,
      reasoning: d.reasoning, evidence: d.evidence, quickFix: d.quick_fix,
      notEvidenced: d.not_evidenced,
      disabled: false, disabledReason: null,
      scoreBeforeCap: wasCapped ? original : null,
      cappedBy: wasCapped ? cap!.id : null,
    }
  })

  // ---- 2 & 3. Add up what is left, over what was available -------------------------------
  // A disabled dimension leaves both sides of the fraction. Scoring it zero would punish a
  // strategy-only call for containing no movement work, which is not a fault being measured.
  const active = dimensions.filter((d) => !d.disabled)
  const raw = active.reduce((sum, d) => sum + d.score!, 0)
  const denominator = active.reduce((sum, d) => sum + d.max, 0)

  // ---- 4 & 5. Percentage, then total caps ------------------------------------------------
  const uncapped = toPercent(raw, denominator)

  const totalCaps = rubric.caps.filter((c) => c.kind === 'total' && observed.has(c.id))
  // When several ceilings apply at once the lowest is the real one.
  const ceiling = totalCaps.reduce((lowest, c) => Math.min(lowest, c.max), 100)
  const percent = Math.min(uncapped, ceiling)

  for (const cap of totalCaps) {
    capsFired.push({
      id: cap.id, condition: cap.condition, why: observed.get(cap.id)!,
      kind: 'total', dimension: null, max: cap.max,
      // True only for the cap that actually bit. A condition can hold while the call was
      // already scoring below its ceiling, and the coach should not be told a cap cost them
      // points it did not cost them.
      changedTheOutcome: cap.max === ceiling && uncapped > ceiling,
    })
  }

  // ---- 6. What it would have scored, had the one thing been done -------------------------
  // Same maths, one score swapped. The model named the dimension and the score; it never
  // computed a total, and neither did anyone but this function.
  const target = draft.one_thing.if_fixed
  const projectedRaw = active.reduce(
    (sum, d) => sum + (d.id === target.dimension ? Math.max(d.score!, target.score) : d.score!),
    0,
  )
  const projectedPercent = Math.min(toPercent(projectedRaw, denominator), ceiling)

  return {
    raw,
    denominator,
    percent,
    band: overallBandFor(rubric, percent),
    capsFired,
    dimensions,
    projected:
      projectedPercent > percent
        ? { percent: projectedPercent, band: overallBandFor(rubric, projectedPercent) }
        : null,
  }
}
