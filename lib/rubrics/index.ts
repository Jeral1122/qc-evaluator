import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Band, DimensionSpec, RubricKey, RubricSpec } from './types.ts'
import { kickoff } from './kickoff.ts'
import { coaching } from './coaching.ts'

export type { Band, Cap, DimensionSpec, OverallBand, RubricKey, RubricSpec } from './types.ts'

export const RUBRICS: Record<RubricKey, RubricSpec> = { kickoff, coaching }

/** Narrows an untrusted string from the request body into a rubric key we know. */
export function isRubricKey(value: unknown): value is RubricKey {
  return value === 'kickoff' || value === 'coaching'
}

export function getRubric(key: RubricKey): RubricSpec {
  return RUBRICS[key]
}

/**
 * Every score this dimension is allowed to take, highest first.
 *
 * A band is a range, so this walks it in steps and collects each landing point. The step is the
 * kick-off rubric's own rule: "any integer works, or a half step where the dimension's max is 5
 * or less." Coaching's bands are single values, so the walk adds one number and stops, which is
 * why one function serves both rubrics.
 *
 * Gaps survive on purpose. Kick-off D3 goes from "Mid 2.5-3.5" straight to "Elite 4.5-5", so 4
 * appears in no band and does not appear here. That gap is the client's, not ours to close.
 *
 * This list becomes the schema the model is forced to answer inside, which is how an
 * out-of-band score gets caught before it ever reaches a report.
 */
export function allowedScores(dimension: DimensionSpec): number[] {
  const step = dimension.max <= 5 ? 0.5 : 1
  const values = new Set<number>()

  for (const band of dimension.bands) {
    // Count the steps rather than adding repeatedly, so 0.5 increments cannot drift.
    const stepCount = Math.round((band.max - band.min) / step)
    for (let i = 0; i <= stepCount; i++) values.add(band.min + i * step)
  }

  return [...values].sort((a, b) => b - a)
}

/** Which band a dimension score landed in, for the label shown beside it on the report. */
export function bandFor(dimension: DimensionSpec, score: number): Band | undefined {
  return dimension.bands.find((band) => score >= band.min && score <= band.max)
}

/**
 * The band for the whole call. `min` is an inclusive lower bound, so exactly 70 is Inconsistent
 * rather than At risk. Every rubric's last band starts at 0, so this always finds one.
 */
export function overallBandFor(rubric: RubricSpec, percent: number): string {
  return rubric.bands.find((band) => percent >= band.min)!.name
}

/**
 * The rubric as the client wrote it, which is what goes into the prompt.
 *
 * Read off disk rather than copied into a TypeScript string, so `rubrics/*.md` stays the single
 * source of truth and matches the exercise repo byte for byte. Vercel needs to be told to bundle
 * these files: see `outputFileTracingIncludes` in next.config.ts.
 */
export function loadRubricMarkdown(rubric: RubricSpec): string {
  return readFileSync(join(process.cwd(), 'rubrics', rubric.markdownFile), 'utf8')
}
