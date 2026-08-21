import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/supabase.ts'
import { isStaleRun, TIMED_OUT_REASON } from '@/lib/scoring/run.ts'
import { Report } from '@/components/report/Report.tsx'
import { Progress } from '@/components/Progress.tsx'
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
        reason={
          stale ? TIMED_OUT_REASON : (run.error_reason ?? 'Scoring failed for a reason that was not recorded.')
        }
      />
    )
  }

  if (run.status !== 'complete' || !run.report) {
    return <Progress runId={run.id} startedAt={run.started_at ?? run.created_at} />
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
function Failure({ reason }: { reason: string }) {
  return (
    <main className="mx-auto max-w-[42rem] px-6 pt-24 sm:px-8">
      <p className="eyebrow" style={{ color: 'var(--color-band-fail)' }}>
        This run failed
      </p>
      <h1 className="mt-3 max-w-[24ch] font-display text-3xl leading-tight">
        No report was produced.
      </h1>
      <p className="mt-6 max-w-[58ch] border-l-2 border-band-fail pl-4 text-[0.95rem] leading-relaxed">
        {reason}
      </p>
      <p className="mt-8 max-w-[54ch] text-sm text-ink-soft">
        Nothing partial was saved. A report is either fully evidenced or it does not exist, so a
        run that failed halfway leaves no half-scored call behind.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-sm border border-rule px-4 py-2 text-sm text-ink-soft hover:border-ink-faint hover:text-ink"
      >
        Score another call
      </Link>
    </main>
  )
}
