import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { buildReportSchema, type ReportDraft } from './schema.ts'
import { SYSTEM_PROMPT, buildUserContent } from './prompt.ts'
import { loadRubricMarkdown } from '../rubrics/index.ts'
import type { RubricSpec } from '../rubrics/types.ts'

/**
 * Opus 5, and this was tested rather than assumed.
 *
 * Cost here is dominated by OUTPUT, not by the transcript: a run produces 10,000 to 14,000
 * output tokens, most of which is the model's own reasoning, against roughly 25,000 input. So
 * the output rate looks like the obvious lever, and Sonnet 5's is $15/M against Opus's $25/M.
 *
 * Sonnet was tried and rejected on evidence, scoring the same transcripts on both:
 *
 *   kickoff-01   Opus 97 Elite   ·  Sonnet REJECTED twice, both times for a quote it had
 *                                   stitched together with an ellipsis, which the prompt
 *                                   forbids explicitly and Opus obeys
 *   kickoff-02   Opus 53 Fail    ·  Sonnet 65 At risk      <- a whole band higher
 *   coaching-01  Opus 95 Elite   ·  Sonnet 100 Elite       <- a perfect 105 of 105
 *
 * The grade inflation is the disqualifying half. This tool exists to tell a business which
 * coaches are underperforming, and a model that reads a failing call as passing does not just
 * lose accuracy, it defeats the product. Sonnet also produced 14% MORE output than Opus, so the
 * real saving was $0.14 a run rather than the 40% the rate card suggests.
 *
 * `SCORING_MODEL` still switches models with no code change. Anything set there should be
 * re-checked against these three numbers first.
 */
export const SCORING_MODEL = process.env.SCORING_MODEL ?? 'claude-opus-5'

/** Thinking tokens count against this too, so it is not just the size of the report. */
const MAX_TOKENS = 24_000

export type ScoringResult = {
  draft: ReportDraft
  usage: {
    inputTokens: number
    outputTokens: number
    /** Written to the cache this run, billed at 1.25x. Only nonzero on a cold run. */
    cacheWriteTokens: number
    /** Served from the cache, billed at 0.1x. Only nonzero within the cache window. */
    cacheReadTokens: number
    ms: number
  }
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

  // Streaming, not because we show progress, but because the SDK refuses a non-streaming
  // request whose max_tokens could push it past the 10 minute HTTP timeout. Nothing here
  // consumes the individual chunks: finalMessage() waits for the whole thing and hands back
  // the validated object.
  const stream = client.messages.stream({
    model: SCORING_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserContent(rubric, loadRubricMarkdown(rubric), transcript, names) },
    ],
    output_config: { format: zodOutputFormat(buildReportSchema(rubric)) },
  })

  const response = await stream.finalMessage()

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
      // input_tokens counts only what was NOT cached, so reporting it alone understates the
      // real input by the size of the rubric. All three numbers or none.
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      ms: Date.now() - startedAt,
    },
  }
}
