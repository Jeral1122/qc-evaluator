import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/supabase.ts'
import { getRubric } from '@/lib/rubrics/index.ts'
import { isStaleRun, TIMED_OUT_REASON } from '@/lib/scoring/run.ts'
import { Report } from '@/components/report/Report.tsx'
import { Progress } from '@/components/Progress.tsx'
import { Shell, Wordmark } from '@/components/Shell.tsx'
import type { Run } from '@/lib/types.ts'

// The row changes underneath this page while a run is in flight, so it can never be cached.
export const dynamic = 'force-dynamic'

export default async function RunPage({ params }: PageProps<'/runs/[id]'>) {
  const { id } = await params

  const { data: run } = await db().from('runs').select('*').eq('id', id).maybeSingle<Run>()
  if (!run) notFound()

  // A row still marked running for longer than the function could have lived is a dead job.
  // The same helper answers this for the status endpoint, so the page and the API can never
  // disagree about whether a run is still alive.
  const stale = isStaleRun(run)

  if (run.status === 'failed' || stale) {
    return (
      <Failure
        runId={run.id}
        reason={
          stale ? TIMED_OUT_REASON : (run.error_reason ?? 'Scoring failed for a reason that was not recorded.')
        }
      />
    )
  }

  if (run.status !== 'complete' || !run.report) {
    // The rubric is a static file, so the page already knows exactly what is being scored and
    // can show it rather than leaving the reader with a spinner and a number.
    const rubric = getRubric(run.rubric_key)
    return (
      <Progress
        runId={run.id}
        startedAt={run.started_at ?? run.created_at}
        rubricTitle={rubric.title}
        dimensions={rubric.dimensions.map((d) => ({ id: d.id, name: d.name, max: d.max }))}
      />
    )
  }

  return <Report run={run} />
}

/**
 * What a failed run looks like.
 *
 * "A failed run says why" is one of the three hard requirements, so this page is a real
 * destination with a real sentence on it, not a toast that disappears. The reasons written by
 * the verifier and the API wrapper are already plain English, which is why they are printed
 * straight through.
 */
function Failure({ reason, runId }: { reason: string; runId: string }) {
  const rail = (
    <>
      <Wordmark context="Failed" />
      <h1 className="font-display text-[2.4rem] leading-[1.1] tracking-tight"
          style={{ color: 'var(--color-lit-fail)' }}>
        No report was produced.
      </h1>
      <p className="rail-soft max-w-[38ch] text-[0.925rem] leading-[1.7] text-rail-soft">
        Nothing partial was saved. A report is either fully evidenced or it does not exist, so a
        run that failed halfway leaves no half-scored call behind.
      </p>
      <p className="rail-soft mt-auto border-t border-rail-rule pt-6 text-[0.7rem] text-rail-faint">
        Run {runId}
      </p>
    </>
  )

  return (
    <Shell rail={rail}>
      <p className="label">What went wrong</p>
      <p className="mt-4 max-w-[68ch] text-[1.05rem] leading-[1.7]">{reason}</p>
      <p className="mt-8 max-w-[68ch] text-[0.95rem] leading-[1.7] text-ink-soft">
        Submitting the transcript again starts a fresh run at a new link. If it fails the same
        way twice, the reason above is the thing to fix.
      </p>
      <Link
        href="/"
        className="mt-10 inline-block border border-rule px-5 py-2.5 text-sm text-ink-soft
                   transition-colors hover:border-ink hover:text-ink"
      >
        Score another call
      </Link>
    </Shell>
  )
}
