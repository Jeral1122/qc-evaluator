import { z } from 'zod'
import { allowedScores } from '../rubrics/index.ts'
import type { DimensionSpec, RubricSpec } from '../rubrics/types.ts'

/**
 * The shape Claude must answer in, built from the rubric rather than typed by hand.
 *
 * A schema here is a contract: the API is handed a description of the exact JSON it is allowed
 * to produce, and the SDK checks the reply against it before we ever see it. Building the
 * schema from the same spec that drives the maths means the two can never disagree about what
 * a dimension is worth.
 *
 * Two things are deliberately NOT asked for:
 *
 *   - No total, no percentage, no band. Every number on the report is computed in TypeScript.
 *     A model asked to add twelve numbers and apply a conditional ceiling is right most of the
 *     time, and most of the time is not a scoring system.
 *
 *   - No band label per dimension. We can derive that from the score with `bandFor`, and asking
 *     for something derivable only adds a way for the answer to contradict itself.
 *
 * What IS asked for is judgment: which bucket the call earned, the quotes behind it, and which
 * cap conditions were true. Those need a reader. The arithmetic does not.
 */

/** Turn a list of permitted scores into "one of exactly these numbers, nothing else". */
function scoreUnion(dimension: DimensionSpec) {
  const literals = allowedScores(dimension).map((value) => z.literal(value))
  return z.union(literals as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]])
}

/**
 * One dimension's answer.
 *
 * Every field is required. Where a value can legitimately be absent it is `.nullable()` rather
 * than `.optional()`, because a strict JSON schema wants a known set of keys, and "present but
 * null" is easier to reason about than "sometimes missing".
 */
function dimensionSchema(dimension: DimensionSpec) {
  const base = {
    reasoning: z
      .string()
      .describe('Why this score. Must open by referring to a specific moment in the transcript.'),
    evidence: z
      .array(z.string())
      .describe(
        'Verbatim quotes from the transcript, copied exactly, that this score rests on. ' +
          'Every quote is checked against the transcript in code. Never write a quote from memory ' +
          'or tidy one up. If there is nothing to quote, return an empty array.',
      ),
    quick_fix: z.string().describe('What the coach had to do differently to reach full marks.'),
    not_evidenced: z
      .boolean()
      .describe(
        'True when the behaviour this dimension measures could not be verified in the transcript, ' +
          'so the score reflects absence rather than a judgement of quality.',
      ),
  }

  // Only coaching D4 is optional, and the rubric spells out how: when a call contains no
  // movement coaching at all, the dimension switches off and leaves the total entirely.
  if (dimension.optional) {
    return z.object({
      ...base,
      score: scoreUnion(dimension)
        .nullable()
        .describe('Null only when this dimension is disabled for this call.'),
      disabled: z
        .boolean()
        .describe(
          'True only when ALL FOUR detection criteria in the rubric are absent. If even one is ' +
            'present, score normally and set this false.',
        ),
      disabled_reason: z
        .string()
        .nullable()
        .describe('One short sentence, only when disabled is true. Otherwise null.'),
    })
  }

  return z.object({ ...base, score: scoreUnion(dimension) })
}

/** The whole report, in the order the coach reads it. */
export function buildReportSchema(rubric: RubricSpec) {
  const dimensionIds = rubric.dimensions.map((d) => d.id) as [string, ...string[]]
  const capIds = rubric.caps.map((c) => c.id) as [string, ...string[]]

  // An object keyed by dimension id, not an array, so each dimension carries its OWN set of
  // permitted scores. An array would force one score type across all twelve and lose that.
  const dimensions = Object.fromEntries(
    rubric.dimensions.map((dimension) => [dimension.id, dimensionSchema(dimension)]),
  )

  return z.object({
    one_thing: z
      .object({
        change: z.string().describe('The single highest-leverage change, written to the coach.'),
        why: z.string(),
        // The brief asks what the call would have scored with this change. Rather than have the
        // model guess a total, it names the dimension and the score that change would have
        // earned, and we recompute the total ourselves.
        if_fixed: z.object({
          dimension: z.enum(dimensionIds).describe('Which dimension this change would lift.'),
          score: z.number().describe('The score that dimension would have earned instead.'),
        }),
      })
      .describe('The one change that moves the number most.'),

    brief: z.string().describe('A few sentences to the coach on how the call went.'),

    red_flags: z
      .array(z.object({ flag: z.string(), why: z.string() }))
      .describe(
        'What puts this client at risk of leaving. Empty array if nothing does. ' +
          'A healthy total can hide these, which is why they are listed separately.',
      ),

    caps_observed: z
      .array(z.object({ id: z.enum(capIds), why: z.string() }))
      .describe(
        'Cap conditions from the top of the rubric that are TRUE of this call. Report what you ' +
          'observe; the consequence is applied in code. Empty array if none apply.',
      ),

    dimensions: z.object(dimensions),
  })
}

export type ReportDraft = z.infer<ReturnType<typeof buildReportSchema>>
