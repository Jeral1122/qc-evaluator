import { z } from 'zod'
import { allowedScores } from '../rubrics/index.ts'
import type { RubricSpec } from '../rubrics/types.ts'

/**
 * The shape Claude must answer in, built from the rubric rather than typed by hand.
 *
 * A schema here is a contract: the API is handed a description of the exact JSON it may
 * produce and enforces it while generating. Building it from the same spec that drives the
 * maths means the two can never disagree about what a dimension is worth.
 *
 * Two things are deliberately NOT asked for:
 *
 *   - No total, no percentage, no band. Every number on the report is computed in TypeScript.
 *     A model asked to add twelve numbers and apply a conditional ceiling is right most of the
 *     time, and most of the time is not a scoring system.
 *
 *   - No band label per dimension. `bandFor` derives it from the score, and asking for
 *     something derivable only adds a way for the answer to contradict itself.
 *
 * WHY THE SCORE UNION IS PER RUBRIC AND NOT PER DIMENSION
 *
 * The first version gave each of the twelve dimensions its own list of permitted scores, so an
 * out-of-band score was unrepresentable. The API rejected it: "the compiled grammar is too
 * large". Structured output is enforced by compiling the schema into a decoding grammar, and
 * twelve distinct unions inside twelve distinct object shapes exceeds what that will accept.
 *
 * So the union is now every score anywhere in this rubric, and the per-dimension check moved
 * into `verify.ts`. The guarantee weakens in one specific way: the model can still return 10 on
 * a dimension whose maximum is 5. It cannot return 8.5, or 11, or a value from the other
 * rubric's scale. What it can now do is fail our own validation instead of being blocked at the
 * API, which fails the run with a readable reason rather than reaching a coach. Caught either
 * way; caught slightly later.
 *
 * Descriptions here are deliberately short. Instructions belong in the system prompt; the
 * schema describes shape.
 */

/** Every score that appears anywhere in this rubric, so the grammar stays small. */
function rubricScoreUnion(rubric: RubricSpec) {
  const values = [...new Set(rubric.dimensions.flatMap(allowedScores))].sort((a, b) => b - a)
  const literals = values.map((value) => z.literal(value))
  return z.union(literals as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]])
}

/** The whole report. Ordered the way the coach reads it. */
export function buildReportSchema(rubric: RubricSpec) {
  const dimensionIds = rubric.dimensions.map((d) => d.id) as [string, ...string[]]
  const capIds = rubric.caps.map((c) => c.id) as [string, ...string[]]
  const score = rubricScoreUnion(rubric)

  // One shape repeated twelve times, rather than twelve shapes. Same reason as above.
  // Nothing is `.optional()`; absence is expressed as null, so the key set never varies.
  const dimension = z.object({
    id: z.enum(dimensionIds),
    score: score.nullable().describe('Null only when disabled is true.'),
    reasoning: z.string().describe('Why this score. Open with a specific moment from the transcript.'),
    evidence: z.array(z.string()).describe('Verbatim quotes, copied exactly. Empty array if there are none.'),
    quick_fix: z.string().describe('What the coach had to do differently to reach full marks.'),
    not_evidenced: z.boolean().describe('True when the behaviour could not be verified in the transcript.'),
    disabled: z.boolean().describe('Only ever true for an optional dimension the rubric says to switch off.'),
    disabled_reason: z.string().nullable().describe('One sentence when disabled, otherwise null.'),
  })

  return z.object({
    one_thing: z.object({
      change: z.string().describe('The single highest-leverage change, written to the coach.'),
      why: z.string(),
      // The brief asks what the call would have scored with this change. Rather than have the
      // model guess a total, it names the dimension and the score that change would earn, and
      // the total is recomputed from that.
      if_fixed: z.object({
        dimension: z.enum(dimensionIds),
        score: score.describe('The score that dimension would have earned instead.'),
      }),
    }),

    brief: z.string().describe('A few sentences to the coach on how the call went.'),

    red_flags: z
      .array(z.object({ flag: z.string(), why: z.string() }))
      .describe('What puts this client at risk of leaving. Empty array if nothing does.'),

    caps_observed: z
      .array(z.object({ id: z.enum(capIds), why: z.string() }))
      .describe('Cap conditions from the top of the rubric that are true of this call.'),

    dimensions: z.array(dimension).describe('All twelve, in order, one entry each.'),
  })
}

export type ReportDraft = z.infer<ReturnType<typeof buildReportSchema>>
export type DimensionDraft = ReportDraft['dimensions'][number]
