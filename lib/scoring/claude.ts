import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { buildReportSchema, type ReportDraft } from './schema.ts'
import { SYSTEM_PROMPT, buildUserContent } from './prompt.ts'
import { loadRubricMarkdown } from '../rubrics/index.ts'
import type { RubricSpec } from '../rubrics/types.ts'

/**
 * Opus 5 by default. The whole exercise is judged on whether the scores are faithful to rubrics
 * full of nuanced reviewer corrections, latency is invisible because this runs in the background,
 * and the volume here is a handful of runs. The env var makes dropping to a faster model a
 * config change rather than a code change.
 */
export const SCORING_MODEL = process.env.SCORING_MODEL ?? 'claude-opus-5'

/** Thinking tokens count against this too, so it is not just the size of the report. */
const MAX_TOKENS = 24_000

export type ScoringResult = {
  draft: ReportDraft
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; ms: number }
}

/**
 * One call. The whole rubric and the whole transcript go in together.
 *
 * Not chunked, because a dimension like "did the coach connect this back to the long-term
 * vision" can rest on something said at minute 3 and something said at minute 48. Split the
 * transcript and every piece scores that dimension half blind.
 *
 * `messages.parse` hands the API a description of the exact JSON we accept and validates the
 * reply against it, so a malformed report is caught here rather than halfway down a page.
 */
export async function scoreTranscript(
  rubric: RubricSpec,
  transcript: string,
  names: { clientName?: string | null; coachName?: string | null } = {},
): Promise<ScoringResult> {
  const client = new Anthropic()
  const startedAt = Date.now()

  const response = await client.messages.parse({
    model: SCORING_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserContent(rubric, loadRubricMarkdown(rubric), transcript, names) },
    ],
    output_config: { format: zodOutputFormat(buildReportSchema(rubric)) },
  })

  // Every one of these means the report is unusable, and each says so in words an operator can
  // act on. "A failed run says why" is a requirement, so a bare exception is not good enough.
  if (response.stop_reason === 'refusal') {
    throw new Error(
      `The model declined to score this transcript (${response.stop_details?.category ?? 'no category given'}).`,
    )
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `The model ran out of room before finishing the report (limit ${MAX_TOKENS} tokens). ` +
        `The transcript may be unusually long.`,
    )
  }
  if (!response.parsed_output) {
    throw new Error('The model returned a report that did not match the required shape.')
  }

  return {
    draft: response.parsed_output,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      ms: Date.now() - startedAt,
    },
  }
}
