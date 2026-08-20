/**
 * Score one transcript from the command line and print the result.
 *
 * Nothing is saved and no database is involved. This exists so we can find out whether the
 * scoring actually works before building anything around it.
 *
 *   ANTHROPIC_API_KEY=... node scripts/score-one.ts kickoff transcripts/kickoff-02.txt
 */
import { readFileSync } from 'node:fs'
import { getRubric, isRubricKey, bandFor, allowedScores } from '../lib/rubrics/index.ts'
import { scoreTranscript, SCORING_MODEL } from '../lib/scoring/claude.ts'

const [rubricKey, transcriptPath] = process.argv.slice(2)

if (!isRubricKey(rubricKey) || !transcriptPath) {
  console.error('usage: node scripts/score-one.ts <kickoff|coaching> <path-to-transcript>')
  process.exit(1)
}

const rubric = getRubric(rubricKey)
const transcript = readFileSync(transcriptPath, 'utf8')

console.log(`${rubric.title} · ${transcriptPath} · ${transcript.length.toLocaleString()} chars · ${SCORING_MODEL}\n`)

const { draft, usage } = await scoreTranscript(rubric, transcript)

// The model returns a list; look them up by id so the print order is the rubric's, not its.
const byId = new Map(draft.dimensions.map((d) => [d.id, d]))

// Raw scores only. No total is printed, because computing the total is Phase 3's job and
// guessing at it here would be exactly the shortcut this design is built to avoid.
for (const dimension of rubric.dimensions) {
  const d = byId.get(dimension.id)!

  if (d.disabled) {
    console.log(`${dimension.id.padEnd(4)} ${dimension.name.padEnd(34)} N/A    ${d.disabled_reason}`)
    continue
  }

  const score = d.score as number
  const label = bandFor(dimension, score)?.name ?? '??'
  const flag = d.not_evidenced ? ' [not evidenced]' : ''
  const quotes = d.evidence.length
  console.log(
    `${dimension.id.padEnd(4)} ${dimension.name.padEnd(34)} ${String(score).padStart(4)}/${String(dimension.max).padEnd(3)} ` +
      `${label.padEnd(8)} ${quotes} quote${quotes === 1 ? '' : 's'}${flag}`,
  )
}

console.log(`\nCAPS OBSERVED`)
if (draft.caps_observed.length === 0) console.log('  none')
for (const cap of draft.caps_observed) {
  const spec = rubric.caps.find((c) => c.id === cap.id)!
  console.log(`  ${cap.id}\n    rubric: ${spec.condition}\n    model:  ${cap.why}`)
}

console.log(`\nTHE ONE THING\n  ${draft.one_thing.change}`)
console.log(`  if fixed: ${draft.one_thing.if_fixed.dimension} scores ${draft.one_thing.if_fixed.score}`)
console.log(`\nBRIEF\n  ${draft.brief}`)
console.log(`\nRED FLAGS`)
if (draft.red_flags.length === 0) console.log('  none')
for (const f of draft.red_flags) console.log(`  ${f.flag}\n    ${f.why}`)

/*
 * The check that matters. Phase 3 turns this into a hard gate that fails the run; here it is
 * only reported, because the point of this script is to see how the model behaves before
 * deciding how strict the gate has to be.
 */
const normalise = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
const haystack = normalise(transcript)
const fabricated: string[] = []
for (const dimension of rubric.dimensions) {
  const d = byId.get(dimension.id)!
  for (const quote of d.evidence) {
    if (!haystack.includes(normalise(quote))) fabricated.push(`${dimension.id}: ${quote}`)
  }
}

console.log(`\nQUOTE CHECK`)
if (fabricated.length === 0) {
  console.log('  every quote was found in the transcript')
} else {
  console.log(`  ${fabricated.length} quote(s) NOT found in the transcript:`)
  for (const q of fabricated) console.log(`    ${q}`)
}

// Sanity check that the schema did its job.
const outOfBand = rubric.dimensions.filter((dimension) => {
  const d = byId.get(dimension.id)!
  return !d.disabled && d.score !== null && !allowedScores(dimension).includes(d.score)
})
console.log(`  ${outOfBand.length === 0 ? 'every score sits in a real band' : `OUT OF BAND: ${outOfBand.map((d) => d.id)}`}`)

console.log(
  `\nUSAGE  ${usage.inputTokens.toLocaleString()} in (${usage.cacheReadTokens.toLocaleString()} cached) · ` +
    `${usage.outputTokens.toLocaleString()} out · ${(usage.ms / 1000).toFixed(1)}s`,
)
