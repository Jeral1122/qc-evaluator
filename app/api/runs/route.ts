import { waitUntil } from '@vercel/functions'
import { db } from '@/lib/supabase.ts'
import { isRubricKey } from '@/lib/rubrics/index.ts'
import { runScoring } from '@/lib/scoring/run.ts'

/**
 * Must match SCORING_MAX_DURATION_SECONDS in lib/scoring/run.ts.
 * Next.js reads this statically out of the file, so it cannot be an imported constant.
 */
export const maxDuration = 300

/** Transcripts are long. Guard against a paste that is not a transcript at all. */
const MAX_TRANSCRIPT_CHARS = 400_000

/**
 * Create a run and hand the scoring off.
 *
 * The order here is the entire durability story:
 *
 *   1. validate
 *   2. WRITE THE ROW          <- the URL becomes valid at this exact moment
 *   3. hand off the scoring
 *   4. reply with the id
 *
 * The row exists before Claude is ever contacted, so the URL handed back is already real. If
 * everything after step 2 falls over, the operator lands on a page that says what went wrong.
 * Score first and write second and a crash leaves them holding a link to nothing.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const { transcript, rubricKey, clientName, coachName } = (body ?? {}) as Record<string, unknown>

  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    return Response.json({ error: 'Paste a transcript first.' }, { status: 400 })
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return Response.json(
      { error: `That transcript is ${transcript.length.toLocaleString()} characters. The limit is ${MAX_TRANSCRIPT_CHARS.toLocaleString()}.` },
      { status: 400 },
    )
  }
  if (!isRubricKey(rubricKey)) {
    return Response.json({ error: 'Choose whether this was a kick-off call or a coaching call.' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('runs')
    .insert({
      rubric_key: rubricKey,
      transcript,
      client_name: typeof clientName === 'string' && clientName.trim() ? clientName.trim() : null,
      coach_name: typeof coachName === 'string' && coachName.trim() ? coachName.trim() : null,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !data) {
    return Response.json({ error: 'Could not save the run. The database rejected it.' }, { status: 500 })
  }

  // waitUntil keeps the function alive after the response has been flushed. The operator's tab
  // is free from here; closing it changes nothing. A real queue is the right answer at volume
  // or with retries, and this is one operator pasting one transcript.
  waitUntil(runScoring(data.id))

  return Response.json({ id: data.id }, { status: 201 })
}
