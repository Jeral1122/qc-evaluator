import { db } from '../supabase.ts'
import { getRubric } from '../rubrics/index.ts'
import { scoreTranscript, SCORING_MODEL } from './claude.ts'
import { verifyDraft } from './verify.ts'
import { computeScoring } from './total.ts'
import type { Run, StoredReport } from '../types.ts'

/**
 * How long the scoring function is allowed to live.
 *
 * Measured worst case is ~182 seconds, so this is that plus room. It has to be declared in two
 * places, because Next.js reads `export const maxDuration` out of a route file statically and
 * cannot follow an import to find it. The route says 300 with a comment pointing here.
 */
export const SCORING_MAX_DURATION_SECONDS = 300

/**
 * Past this, a row still marked `running` is a corpse rather than a job in progress.
 *
 * A `try/catch` only fires while the process is alive. When a function exceeds its duration the
 * platform terminates it outright, the catch never runs, and nothing writes `failed`. The
 * process cannot report its own death, so the reader works it out from the clock instead.
 */
export const STALE_AFTER_MS = (SCORING_MAX_DURATION_SECONDS + 30) * 1000

/** The sentence an operator sees when a job died without being able to say so. */
export const TIMED_OUT_REASON =
  'This took longer than expected and was stopped before it finished, so no report was ' +
  'produced. Submitting the transcript again will start it over.'

/**
 * Is this row a job in progress, or a corpse?
 *
 * Lives here rather than in the two places that ask, so the page and the status endpoint can
 * never drift into disagreeing about whether a run is dead. It also keeps the clock out of
 * React's render path, where reading the time is genuinely a bug: a value that changes on every
 * render is not something a component should be deciding from.
 *
 * `started_at` is null for a row that never got claimed, in which case the clock runs from when
 * it was created. A run that sits in `queued` forever is just as dead as one that hung.
 */
export function isStaleRun(run: {
  status: string
  started_at: string | null
  created_at: string
}): boolean {
  if (run.status !== 'running' && run.status !== 'queued') return false
  const began = Date.parse(run.started_at ?? run.created_at)
  return Date.now() - began > STALE_AFTER_MS
}

/**
 * The whole scoring job, start to finish.
 *
 * Runs AFTER the response has already gone back to the browser, so nothing here is being waited
 * on. Every exit writes a terminal status to the row, because the page is watching that row and
 * a row that never reaches a terminal state is a spinner that never stops.
 */
export async function runScoring(runId: string): Promise<void> {
  const supabase = db()

  try {
    // Claim the row. Matching on status = 'queued' means a second invocation for the same id
    // finds nothing and stops, rather than two workers scoring the same transcript at once.
    const { data: run, error } = await supabase
      .from('runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', runId)
      .eq('status', 'queued')
      .select()
      .single<Run>()

    if (error || !run) return // already claimed, or already gone

    const rubric = getRubric(run.rubric_key)

    // 1. One call: whole rubric, whole transcript.
    const { draft } = await scoreTranscript(rubric, run.transcript, {
      clientName: run.client_name,
      coachName: run.coach_name,
    })

    // 2. The gate. Fabricated quotes and out-of-band scores die here, not on the page.
    const verified = verifyDraft(rubric, run.transcript, draft)

    // 3. The arithmetic, all of it, in code.
    const scoring = computeScoring(rubric, verified)

    const report: StoredReport = {
      rubricKey: rubric.key,
      rubricTitle: rubric.title,
      model: SCORING_MODEL,
      scoredAt: new Date().toISOString(),
      scoring,
      oneThing: {
        change: verified.one_thing.change,
        why: verified.one_thing.why,
        ifFixed: verified.one_thing.if_fixed,
      },
      brief: verified.brief,
      redFlags: verified.red_flags,
    }

    await supabase
      .from('runs')
      .update({
        status: 'complete',
        report,
        total_score: scoring.percent,
        band: scoring.band,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)
  } catch (cause) {
    // Whatever went wrong, the operator gets a sentence rather than silence. verifyDraft and
    // the Claude wrapper both throw messages written to be read by a person, so most of the
    // time this passes one straight through.
    await supabase
      .from('runs')
      .update({
        status: 'failed',
        error_reason: cause instanceof Error ? cause.message : 'Scoring failed for an unknown reason.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)
  }
}
