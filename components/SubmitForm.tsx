'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The only input surface in the whole product.
 *
 * Paste a transcript, say which kind of call it was, submit. Client and coach names are optional
 * operator input rather than parsed out of the transcript, because reading a name out of a
 * transcript is guessing and this system does not guess.
 *
 * On success it redirects to the run's URL immediately. The scoring has not finished and does
 * not need to: the row already exists, so the page is real from this moment.
 */
export function SubmitForm() {
  const router = useRouter()
  const [transcript, setTranscript] = useState('')
  const [rubricKey, setRubricKey] = useState<'kickoff' | 'coaching'>('kickoff')
  const [clientName, setClientName] = useState('')
  const [coachName, setCoachName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
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

  const field =
    'w-full rounded-sm border border-rule bg-white px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-ink-faint'

  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <div>
        <label htmlFor="transcript" className="eyebrow">Transcript</label>
        <textarea
          id="transcript"
          required
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the full call transcript here."
          rows={14}
          className={`${field} mt-2 resize-y font-mono text-[0.8rem] leading-relaxed`}
        />
        {transcript.length > 0 && (
          <p className="mt-1 text-right text-xs text-ink-faint">
            {transcript.length.toLocaleString()} characters
          </p>
        )}
      </div>

      <fieldset>
        <legend className="eyebrow">Call type</legend>
        <div className="mt-2 flex gap-2">
          {([
            ['kickoff', 'Kick-off call'],
            ['coaching', 'Coaching call'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRubricKey(value)}
              aria-pressed={rubricKey === value}
              className={`rounded-sm border px-4 py-2 text-sm transition-colors ${
                rubricKey === value
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule text-ink-soft hover:border-ink-faint'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          The two are scored against different rubrics, written by the client.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="coach" className="eyebrow">Coach <span className="normal-case">(optional)</span></label>
          <input id="coach" value={coachName} onChange={(e) => setCoachName(e.target.value)} className={`${field} mt-2`} />
        </div>
        <div>
          <label htmlFor="client" className="eyebrow">Client <span className="normal-case">(optional)</span></label>
          <input id="client" value={clientName} onChange={(e) => setClientName(e.target.value)} className={`${field} mt-2`} />
        </div>
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-band-fail pl-3 text-sm text-band-fail">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || transcript.trim().length === 0}
        className="rounded-sm bg-ink px-5 py-2.5 text-sm text-paper transition-opacity disabled:opacity-40"
      >
        {submitting ? 'Starting…' : 'Score this call'}
      </button>
    </form>
  )
}
