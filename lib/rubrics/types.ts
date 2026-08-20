/**
 * The shape of a rubric, expressed as code.
 *
 * The rubrics themselves are markdown files the client wrote. Those files go into the prompt
 * whole, because they carry the calibration notes that keep scoring honest. But code cannot do
 * arithmetic against prose, so these types are the machine-readable half: what the dimensions
 * are, what each one can score, and what can cap the call.
 */

/**
 * One row of a dimension's scoring table.
 *
 * The two rubrics write this row differently, which is why `min` and `max` are separate.
 * Kick-off writes ranges ("Elite, 9-10"), so min is 9 and max is 10.
 * Coaching writes single values ("15/15 Elite"), so min and max are both 15.
 * One shape covers both.
 */
export type Band = {
  name: string
  min: number
  max: number
}

/** One of the twelve things a call is scored on. */
export type DimensionSpec = {
  /** "D1" through "D12". Stable, and what the model is asked to return. */
  id: string
  name: string
  /** The most this dimension can contribute. Not equal across dimensions. */
  max: number
  /** Highest band first. */
  bands: Band[]
  /** Coaching D4 only. A call with no movement coaching drops it from the total entirely. */
  optional?: true
}

/**
 * An automatic ceiling, checked before scoring.
 *
 * Both rubrics open with a table of these. They are the reason the final number is not a sum:
 * a call can do everything else well and still be held at 70 because one thing was missing.
 */
export type Cap =
  /** Clamps the whole call's percentage. */
  | { id: string; kind: 'total'; max: number; condition: string }
  /** Clamps one dimension before anything is added up. */
  | { id: string; kind: 'dimension'; dimension: string; max: number; condition: string }

/** A band for the call as a whole. `min` is inclusive, so exactly 70 is Inconsistent. */
export type OverallBand = { name: string; min: number }

export type RubricKey = 'kickoff' | 'coaching'

export type RubricSpec = {
  key: RubricKey
  title: string
  dimensions: DimensionSpec[]
  caps: Cap[]
  /** Highest first. */
  bands: OverallBand[]
  /** Filename inside `rubrics/`, the text that goes into the prompt. */
  markdownFile: string
}
