'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shell, Wordmark } from './Shell.tsx'

/**
 * Shown while a run is queued or running.
 *
 * Polls the status endpoint and reloads once the run reaches a terminal state. Polling rather
 * than streaming because there is exactly one thing to learn, has it finished, and a websocket
 * to learn it would be machinery nobody asked for.
 *
 * The dimension list is NOT progress. Nothing here knows which dimension the model is on, and
 * ticking them off one by one would be a lie told in pixels. It is the contents page of the
 * document being written, so the wait has something to read.
 */
export function Progress({
  runId, startedAt, rubricTitle, dimensions,
}: {
  runId: string
  startedAt: string
  rubricTitle: string
  dimensions: { id: string; name: string; max: number }[]
}) {
  const router = useRouter()
  const [elapsed, setElapsed] = useState<number | null>(null)

  // Reading the clock during render is a bug waiting to happen, so the first tick sets it.
  useEffect(() => {
    const began = Date.parse(startedAt)
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - began) / 1000)))
    update()
    const tick = setInterval(update, 1000)
    return () => clearInterval(tick)
  }, [startedAt])

  useEffect(() => {
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
    return () => clearInterval(poll)
  }, [runId, router])

  const clock =
    elapsed === null ? '—' : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`

  const rail = (
    <>
      <Wordmark context={rubricTitle} />

      <h1 className="font-display text-[2.4rem] leading-[1.1] tracking-tight">
        Reading the transcript.
      </h1>

      <p className="font-display text-5xl leading-none tabular-nums text-rail-faint">{clock}</p>

      <p className="rail-soft max-w-[38ch] text-[0.925rem] leading-[1.7] text-rail-soft">
        Every score has to be backed by something actually said on the call, so this usually
        takes two to three minutes.
      </p>

      <p className="rail-soft mt-auto border-t border-rail-rule pt-6 text-sm leading-relaxed text-rail-soft">
        You can close this tab. The work is happening on our side, not in your browser, and this
        link will have the finished report whenever you come back to it.
      </p>
    </>
  )

  return (
    <Shell rail={rail}>
      <p className="label">What is being scored</p>
      <ul className="mt-5">
        {dimensions.map((d) => (
          <li
            key={d.id}
            className="flex items-baseline gap-5 border-b border-rule py-3 text-[0.95rem] text-ink-faint"
          >
            <span className="w-8 shrink-0 text-xs">{d.id}</span>
            <span className="flex-1">{d.name}</span>
            <span className="shrink-0 text-xs tabular-nums">{d.max}</span>
          </li>
        ))}
      </ul>
    </Shell>
  )
}
