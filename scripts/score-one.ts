/**
 * Score one transcript from the command line and print the finished report.
 *
 * Runs the real pipeline end to end: one Claude call, the verification gate, then the maths.
 * Nothing is saved and no database is involved, so this works before Supabase exists and stays
 * useful afterwards as the fastest way to see what a change does to a real report.
 *
 *   node --env-file=.env scripts/score-one.ts kickoff transcripts/kickoff-02.txt
 */
import { readFileSync } from 'node:fs'
import { getRubric, isRubricKey } from '../lib/rubrics/index.ts'
import { scoreTranscript, SCORING_MODEL } from '../lib/scoring/claude.ts'
import { verifyDraft, VerificationError } from '../lib/scoring/verify.ts'
import { computeScoring } from '../lib/scoring/total.ts'

const [rubricKey, transcriptPath] = process.argv.slice(2)

if (!isRubricKey(rubricKey) || !transcriptPath) {
  console.error('usage: node --env-file=.env scripts/score-one.ts <kickoff|coaching> <transcript>')
  process.exit(1)
}

const rubric = getRubric(rubricKey)
const transcript = readFileSync(transcriptPath, 'utf8')

console.log(
  `${rubric.title} · ${transcriptPath} · ${transcript.length.toLocaleString()} chars · ${SCORING_MODEL}\n`,
)

const { draft, usage } = await scoreTranscript(rubric, transcript)

// The gate. In production this failing means the run is marked failed and the coach never sees
// it, so here it should be just as loud.
let verified
try {
  verified = verifyDraft(rubric, transcript, draft)
} catch (error) {
  if (error instanceof VerificationError) {
    console.error(`REJECTED\n  ${error.message}\n`)
    console.error('This run would have been marked failed and never reached a coach.')
    process.exit(1)
  }
  throw error
}

const scoring = computeScoring(rubric, verified)

/* ---- the report ---- */

console.log(`${scoring.percent}/100   ${scoring.band.toUpperCase()}`)
console.log(`raw ${scoring.raw} of ${scoring.denominator} available`)
if (scoring.projected) {
  console.log(`would be ${scoring.projected.percent} (${scoring.projected.band}) with the one thing fixed`)
}

console.log()
for (const d of scoring.dimensions) {
  if (d.disabled) {
    console.log(`${d.id.padEnd(4)} ${d.name.padEnd(34)}  N/A       ${d.disabledReason}`)
    continue
  }
  const capped = d.cappedBy ? ` capped from ${d.scoreBeforeCap} by ${d.cappedBy}` : ''
  const flag = d.notEvidenced ? ' [not evidenced]' : ''
  console.log(
    `${d.id.padEnd(4)} ${d.name.padEnd(34)} ${String(d.score).padStart(4)}/${String(d.max).padEnd(3)} ` +
      `${(d.band ?? '??').padEnd(8)} ${d.evidence.length} quote${d.evidence.length === 1 ? '' : 's'}${flag}${capped}`,
  )
}

console.log(`\nCAPS`)
if (scoring.capsFired.length === 0) console.log('  none fired')
for (const cap of scoring.capsFired) {
  console.log(`  ${cap.id} (${cap.kind}, max ${cap.max})${cap.changedTheOutcome ? '' : ' — true, but cost nothing'}`)
  console.log(`    ${cap.why}`)
}

console.log(`\nTHE ONE THING\n  ${verified.one_thing.change}`)
console.log(`\nBRIEF\n  ${verified.brief}`)
console.log(`\nRED FLAGS`)
if (verified.red_flags.length === 0) console.log('  none')
for (const f of verified.red_flags) console.log(`  ${f.flag}\n    ${f.why}`)

// Per million tokens, by model. Cache writes bill at 1.25x input, cache reads at 0.1x.
// Hardcoding one model's rates here silently mispriced every other model, so the table is
// keyed and an unknown model says so rather than quietly reporting a wrong number.
const RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}
const base = RATES[SCORING_MODEL]
const RATE = base && {
  input: base.input,
  output: base.output,
  cacheWrite: base.input * 1.25,
  cacheRead: base.input * 0.1,
}
const cost =
  RATE &&
  (usage.inputTokens * RATE.input +
    usage.outputTokens * RATE.output +
    usage.cacheWriteTokens * RATE.cacheWrite +
    usage.cacheReadTokens * RATE.cacheRead) /
    1_000_000

console.log(
  `\nUSAGE  ${usage.inputTokens.toLocaleString()} uncached in · ` +
    `${usage.cacheWriteTokens.toLocaleString()} cache write · ` +
    `${usage.cacheReadTokens.toLocaleString()} cache read · ` +
    `${usage.outputTokens.toLocaleString()} out · ${(usage.ms / 1000).toFixed(1)}s`,
)
console.log(cost === undefined ? `COST   no published rate on file for ${SCORING_MODEL}` : `COST   $${cost.toFixed(4)}`)
console.log(`\nEvery quote above was verified present in the transcript, or this would have exited 1.`)
