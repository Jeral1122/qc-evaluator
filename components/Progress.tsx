'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Shown while a run is queued or running.
 *
 * Polls the status endpoint and reloads the page once the run reaches a terminal state. Polling
 * rather than streaming because there is exactly one thing to learn (has it finished) and a
 * websocket to learn it would be machinery nobody asked for.
 *
 * Every three seconds. A run takes two to three minutes, so this is roughly fifty requests
 * against a single indexed row, and it means the report appears within a few seconds of being
 * ready rather than on a refresh the operator has to think about.
 *
 * The elapsed counter is not decoration. Without it a two minute wait is indistinguishable from
 * a hang, and the whole point of the run page is that it never leaves anyone guessing.
 */
export function Progress({ runId, startedAt }: { runId: string; startedAt: string }) {
  const router = useRouter()
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - Date.parse(startedAt)) / 1000))

  useEffect(() => {
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000)

    const poll = setInterval(async () => {
      try {
        const response = await fetch(`/api/runs/${runId}`, { cache: 'no-store' })
        if (!response.ok) return
        const run = await response.json()
        // The status endpoint also reaps rows whose job died silently, so 'failed' can arrive
        // here without the scoring process ever having written it.
        if (run.status === 'complete' || run.status === 'failed') router.refresh()
      } catch {
        // A dropped request is not worth surfacing. The next tick tries again.
      }
    }, 3000)

    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [runId, router])

  const minutes = Math.floor(elapsed / 60)
  const seconds = String(elapsed % 60).padStart(2, '0')

  return (
    <main className="mx-auto max-w-[42rem] px-6 pt-24 sm:px-8">
      <p className="eyebrow">Scoring</p>
      <h1 className="mt-3 font-display text-3xl leading-tight">Reading the transcript.</h1>
      <p className="mt-4 max-w-[54ch] text-[0.95rem] leading-relaxed text-ink-soft">
        Twelve dimensions, each one evidenced against the transcript. This usually takes two to
        three minutes.
      </p>
      <p className="mt-8 font-display text-2xl text-ink-faint">
        {minutes}:{seconds}
      </p>
      <p className="mt-8 max-w-[54ch] border-l-2 border-rule pl-4 text-sm text-ink-soft">
        You can close this tab. The scoring is running on the server, not in your browser, and
        this link will have the finished report whenever you come back to it.
      </p>
    </main>
  )
}
