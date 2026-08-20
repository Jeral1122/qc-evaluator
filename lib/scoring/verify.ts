import { allowedScores } from '../rubrics/index.ts'
import type { RubricSpec } from '../rubrics/types.ts'
import type { DimensionDraft, ReportDraft } from './schema.ts'

/**
 * Everything the schema could not guarantee.
 *
 * The API blocks a score of 8.5 or 11 because those appear nowhere in the rubric. It cannot
 * block a 10 on a dimension whose maximum is 5, because 10 is legal somewhere in the rubric and
 * the compiled grammar has to stay small enough to accept. So the per-dimension rules live here,
 * and so does the check the whole exercise is built around: did the model make a quote up.
 *
 * Every failure throws. A run that fails is a run that says why, which is what the brief asks
 * for. A run that quietly ships a wrong number is not.
 */

export class VerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VerificationError'
  }
}

/**
 * Make two pieces of text comparable without making them equal.
 *
 * A transcript wraps lines wherever it happens to wrap; a model rewrapping a quote is not
 * inventing anything. Models also routinely turn a straight apostrophe into a curly one and a
 * hyphen into a dash. Both are typography, not content.
 *
 * So whitespace, letter case and quote/dash characters are normalised, and nothing else is.
 * Word order and word choice must match exactly. That is the line: HOW the characters are
 * written can vary, WHICH words are there cannot.
 */
function normalise(text: string): string {
  return text
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export type VerifiedDraft = ReportDraft & { dimensions: DimensionDraft[] }

/**
 * Check a draft against the rubric and the transcript it claims to describe.
 *
 * Returns the draft unchanged when everything holds. Throws with a message naming the dimension
 * and the offending value when it does not, because an operator reading "scoring failed" learns
 * nothing and an operator reading "D3 scored 4, which sits between Mid and Elite" learns
 * everything.
 */
export function verifyDraft(
  rubric: RubricSpec,
  transcript: string,
  draft: ReportDraft,
): VerifiedDraft {
  const haystack = normalise(transcript)
  const byId = new Map(draft.dimensions.map((d) => [d.id, d]))

  // 1. Every dimension answered, once, and nothing invented.
  const missing = rubric.dimensions.filter((d) => !byId.has(d.id)).map((d) => d.id)
  if (missing.length > 0) {
    throw new VerificationError(`The model did not score ${missing.join(', ')}.`)
  }
  if (byId.size !== draft.dimensions.length) {
    throw new VerificationError('The model returned the same dimension more than once.')
  }

  for (const spec of rubric.dimensions) {
    const d = byId.get(spec.id)!
    const where = `${spec.id} (${spec.name})`

    // 2. Only the dimension the rubric marks optional may switch itself off.
    if (d.disabled && !spec.optional) {
      throw new VerificationError(`${where} was disabled, but this dimension is not optional.`)
    }

    if (d.disabled) {
      if (d.score !== null) {
        throw new VerificationError(`${where} is disabled but still returned a score.`)
      }
      if (!d.disabled_reason?.trim()) {
        throw new VerificationError(`${where} is disabled without saying why.`)
      }
      continue // a disabled dimension has nothing left to check
    }

    // 3. A score the rubric does not offer for THIS dimension.
    if (d.score === null) {
      throw new VerificationError(`${where} returned no score and is not disabled.`)
    }
    const permitted = allowedScores(spec)
    if (!permitted.includes(d.score)) {
      throw new VerificationError(
        `${where} scored ${d.score}, which its table does not offer. It allows ${permitted.join(', ')}.`,
      )
    }

    // 4. Credit has to be paid for in quotes. Anything above the bottom of the table needs
    //    something from the transcript behind it, or the score is an opinion.
    const lowest = permitted.at(-1)!
    if (d.score > lowest && d.evidence.length === 0) {
      throw new VerificationError(
        `${where} scored ${d.score} with no evidence. A score above ${lowest} needs a quote behind it.`,
      )
    }

    // 5. The check the exercise is built around.
    for (const quote of d.evidence) {
      if (!quote.trim()) {
        throw new VerificationError(`${where} returned an empty quote.`)
      }
      if (!haystack.includes(normalise(quote))) {
        throw new VerificationError(
          `${where} quoted something that is not in the transcript: "${quote.slice(0, 120)}"`,
        )
      }
    }
  }

  // 6. The counterfactual has to be a real score for the dimension it names.
  const target = rubric.dimensions.find((d) => d.id === draft.one_thing.if_fixed.dimension)
  if (!target) {
    throw new VerificationError(`The one thing points at ${draft.one_thing.if_fixed.dimension}, which does not exist.`)
  }
  if (!allowedScores(target).includes(draft.one_thing.if_fixed.score)) {
    throw new VerificationError(
      `The one thing says ${target.id} would score ${draft.one_thing.if_fixed.score}, which that dimension cannot score.`,
    )
  }

  return draft as VerifiedDraft
}
