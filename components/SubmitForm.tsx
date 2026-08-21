'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RubricKey } from '@/lib/rubrics/types.ts'

export type RubricSummary = {
  key: RubricKey
  title: string
  dimensions: number
  points: number
  first: string
  last: string
}

/**
 * The only input surface in the product, laid out as an intake slip rather than a form.
 *
 * A label column, hairline rules between rows, and the transcript given the space it deserves.
 * Same vocabulary as the report page, so the two read as one system instead of two screens
 * someone happened to build in the same week.
 *
 * Client and coach names are optional operator input rather than parsed out of the transcript,
 * because reading a name out of a transcript is guessing and this system does not guess.
 */
export function SubmitForm({ rubrics }: { rubrics: RubricSummary[] }) {
  const router = useRouter()
  const [transcript, setTranscript] = useState('')
  const [rubricKey, setRubricKey] = useState<RubricKey>('kickoff')
  const [clientName, setClientName] = useState('')
  const [coachName, setCoachName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const chosen = rubrics.find((r) => r.key === rubricKey)!
  const ready = transcript.trim().length > 0 && !submitting

  // A transcript is a long paste and the submit button ends up far from the cursor.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') formRef.current?.requestSubmit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript, rubricKey, clientName, coachName }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Something went wrong.')
        setSubmitting(false)
        return
      }
      router.push(`/runs/${data.id}`)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setSubmitting(false)
    }
  }

  // Rough, and honestly labelled as rough. Four measured runs landed between two and three
  // minutes regardless of transcript length, because the time goes on writing the report
  // rather than on reading the call.
  const characters = transcript.length

  return (
    <form ref={formRef} onSubmit={submit}>
      <Row label="Call type" first>
        <div className="flex flex-wrap gap-2">
          {rubrics.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRubricKey(r.key)}
              aria-pressed={rubricKey === r.key}
              className={`rounded-sm border px-3.5 py-1.5 text-sm transition-colors ${
                rubricKey === r.key
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {r.title}
            </button>
          ))}
        </div>
        {/* Read out of the rubric files, so this cannot describe a rubric we do not have. */}
        <p className="mt-3 max-w-[54ch] text-[0.9rem] leading-relaxed text-ink-soft">
          Scored on {chosen.dimensions} things worth {chosen.points} points in total, from{' '}
          {chosen.first.toLowerCase()} through to {chosen.last.toLowerCase()}.
        </p>
      </Row>

      <Row label="Coach" hint="optional">
        <NameField value={coachName} onChange={setCoachName} placeholder="The coach being reviewed" />
      </Row>

      <Row label="Client" hint="optional">
        <NameField value={clientName} onChange={setClientName} placeholder="Who they were coaching" />
      </Row>

      {/* The transcript gets the page rather than a boxed field, because it is the thing the
          whole product is about. A left rule instead of a border, the way a manuscript margin
          works, so it reads as a document and not as an input. */}
      <div className="border-t border-rule pt-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="transcript" className="label">Transcript</label>
          <span className="text-xs tabular-nums text-ink-faint">
            {characters === 0 ? 'nothing pasted yet' : `${characters.toLocaleString()} characters`}
          </span>
        </div>

        <textarea
          id="transcript"
          required
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={'[Coach]: so what actually brought you here?\n[Client]: my foot has been hurting for about fourteen months now…'}
          rows={12}
          className="mt-4 w-full resize-y border-l border-rule bg-transparent py-3 pl-4 pr-3 font-mono text-[0.8rem] leading-relaxed outline-none transition-colors placeholder:text-ink-faint focus:border-ink focus:bg-quote/50"
        />
      </div>

      {error && (
        <p role="alert" className="mt-5 border-l border-band-fail pl-3 text-sm text-band-fail">
          {error}
        </p>
      )}

      <div className="mt-7 flex items-center justify-between gap-4 border-t border-rule pt-6">
        <p className="max-w-[34ch] text-xs leading-relaxed text-ink-faint">
          This takes two to three minutes. You can close the tab and come back to it.
        </p>
        <button
          type="submit"
          disabled={!ready}
          className={`flex shrink-0 items-center gap-2.5 rounded-sm px-5 py-2.5 text-sm transition-colors ${
            ready
              ? 'bg-ink text-paper'
              : 'cursor-not-allowed border border-rule text-ink-faint'
          }`}
        >
          {submitting ? 'Starting…' : 'Score this call'}
          <kbd className={`hidden font-sans text-[0.7rem] sm:inline ${ready ? 'text-paper/50' : 'text-ink-faint'}`}>⌘↵</kbd>
        </button>
      </div>
    </form>
  )
}

/** One line of the slip: label on the left, field on the right, hairline above. */
function Row({
  label, hint, first, children,
}: { label: string; hint?: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid grid-cols-1 gap-x-8 gap-y-2 py-7 sm:grid-cols-[8rem_1fr] ${
        first ? 'pt-0' : 'border-t border-rule'
      }`}
    >
      <div className="pt-0.5">
        <span className="label">{label}</span>
        {hint && <span className="ml-2 text-xs text-ink-faint">{hint}</span>}
      </div>
      <div>{children}</div>
    </div>
  )
}

/** Underlined rather than boxed, so a row of these reads as a form and not as a stack of tiles. */
function NameField({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-sm border-b border-rule bg-transparent pb-1.5 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
    />
  )
}
