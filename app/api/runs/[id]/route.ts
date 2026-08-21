import { db } from '@/lib/supabase.ts'
import { isStaleRun, TIMED_OUT_REASON } from '@/lib/scoring/run.ts'
import type { Run } from '@/lib/types.ts'

/** What the page polls while a run is queued or running. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: run, error } = await db()
    .from('runs')
    .select('id, status, error_reason, report, total_score, band, client_name, coach_name, rubric_key, created_at, started_at, completed_at')
    .eq('id', id)
    .maybeSingle<Run>()

  // An unparseable uuid makes Postgres complain rather than return nothing, so both cases are
  // the same answer to the operator: this run does not exist.
  if (error || !run) {
    return Response.json({ error: 'No run with that id.' }, { status: 404 })
  }

  return Response.json(await reapIfStale(run))
}

/**
 * Decide whether a row that still says `running` is actually dead.
 *
 * The failure this exists for: the scoring function exceeds its duration and the platform kills
 * it mid-flight. The catch in runScoring never executes, so nothing ever writes `failed`, and
 * the row sits at `running` while the operator watches a spinner that will never resolve. That
 * silently breaks "a failed run says why" through the one path where no code of ours runs.
 *
 * A dead process cannot report its own death, so the reader infers it from the clock.
 *
 * This is a GET with a write in it, which is a smell and worth naming. The alternative is a
 * scheduled job that reaps stale rows, which is correct at volume and is what a real deployment
 * should do. Here it would be a cron, a second deployment target and an hour, to tidy up a row
 * nobody is looking at. The write is idempotent and only ever moves a row into a terminal state.
 */
async function reapIfStale(run: Run): Promise<Run> {
  if (!isStaleRun(run)) return run

  const reaped: Partial<Run> = {
    status: 'failed',
    error_reason: TIMED_OUT_REASON,
    completed_at: new Date().toISOString(),
  }

  // Still guarded on the status it had, so a job that finished a moment ago is never overwritten.
  await db().from('runs').update(reaped).eq('id', run.id).eq('status', run.status)

  return { ...run, ...reaped } as Run
}
