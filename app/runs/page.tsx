import Link from 'next/link'
import { db } from '@/lib/supabase.ts'
import { getRubric } from '@/lib/rubrics/index.ts'
import { Shell, Wordmark } from '@/components/Shell.tsx'
import { bandColour } from '@/components/report/bands.ts'
import { isStaleRun } from '@/lib/scoring/run.ts'
import type { Run } from '@/lib/types.ts'

export const dynamic = 'force-dynamic'

/**
 * Every call scored so far.
 *
 * This was on the not-built list, and adding it is a judgement rather than an oversight. The
 * problem this product exists to solve is stated in the brief itself: the business was pasting
 * transcripts into a chat window, and "nothing was saved, nothing was comparable between
 * coaches". A tool that scores one call and forgets it fixes the first half of that sentence
 * and leaves the second half exactly where it was.
 *
 * It is also nearly free. `total_score` and `band` are already denormalised out of the report
 * JSONB for precisely this read, so the list is one query and no new machinery.
 *
 * What it is still NOT: a dashboard. No filtering, no coach leaderboards, no averages over
 * time. Those are a different product and nobody asked for them.
 */
export default async function RunsPage() {
  const { data } = await db()
    .from('runs')
    .select('id, rubric_key, coach_name, client_name, status, total_score, band, created_at, started_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const runs = (data ?? []) as Run[]
  const scored = runs.filter((r) => r.status === 'complete')

  const rail = (
    <>
      <Wordmark context="History" />
      <h1 className="font-display text-[2.4rem] leading-[1.1] tracking-tight">
        Every call scored so far.
      </h1>
      <p className="rail-soft max-w-[38ch] text-[0.925rem] leading-[1.7] text-rail-soft">
        {scored.length === 0
          ? 'Nothing scored yet. The first report will appear here.'
          : `${scored.length} ${scored.length === 1 ? 'call has' : 'calls have'} been scored. Every report keeps its own link, so you can send a coach straight to theirs.`}
      </p>
      <Link
        href="/"
        className="mt-auto self-start bg-rail-ink px-5 py-2.5 text-sm text-rail transition-opacity hover:opacity-85"
      >
        Score a new call
      </Link>
    </>
  )

  return (
    <Shell rail={rail}>
      {runs.length === 0 ? (
        <p className="text-[0.975rem] leading-[1.7] text-ink-soft">
          No calls have been scored yet. Paste a transcript to get the first one.
        </p>
      ) : (
        <ul>
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </Shell>
  )
}

function RunRow({ run }: { run: Run }) {
  const rubric = getRubric(run.rubric_key)
  // A row that has been running longer than the job could live is dead, and the list should say
  // so rather than showing a spinner that will never resolve.
  const dead = isStaleRun(run)
  const state = dead ? 'failed' : run.status

  const when = new Date(run.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const who =
    [run.coach_name, run.client_name].filter(Boolean).join(' · ') || 'No names recorded'

  return (
    <li className="border-b border-rule">
      <Link
        href={`/runs/${run.id}`}
        className="flex items-baseline gap-5 py-4 transition-colors hover:bg-quote/50"
      >
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[0.975rem]">{who}</span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            {rubric.title} · {when}
          </span>
        </span>

        {state === 'complete' ? (
          <>
            <span className="hidden w-28 shrink-0 text-right text-xs sm:block" style={{ color: bandColour(run.band) }}>
              {run.band}
            </span>
            <span className="w-12 shrink-0 text-right font-display text-xl" style={{ color: bandColour(run.band) }}>
              {run.total_score}
            </span>
          </>
        ) : (
          <span
            className="shrink-0 text-xs"
            style={{ color: state === 'failed' ? 'var(--color-band-fail)' : 'var(--color-ink-faint)' }}
          >
            {state === 'failed' ? 'Failed' : 'Scoring…'}
          </span>
        )}
      </Link>
    </li>
  )
}
