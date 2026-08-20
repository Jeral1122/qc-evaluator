import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RUBRICS, allowedScores, bandFor, overallBandFor } from '../lib/rubrics/index.ts'
import type { RubricSpec } from '../lib/rubrics/types.ts'

const specs = Object.values(RUBRICS)

/* ------------------------------------------------------------------ *
 * Structure. Things that must be true of any rubric spec.
 * ------------------------------------------------------------------ */

test('each rubric has exactly twelve dimensions with unique ids', () => {
  for (const spec of specs) {
    assert.equal(spec.dimensions.length, 12, spec.key)
    const ids = spec.dimensions.map((d) => d.id)
    assert.equal(new Set(ids).size, 12, `${spec.key} has duplicate ids`)
  }
})

test('maximums sum to what the files actually say', () => {
  const sum = (s: RubricSpec) => s.dimensions.reduce((t, d) => t + d.max, 0)
  assert.equal(sum(RUBRICS.kickoff), 100)
  // 105, not 100. The rubric's prose disagrees with its own tables. See ARCHITECTURE.md.
  assert.equal(sum(RUBRICS.coaching), 105)
})

test('bands run highest to lowest, sit inside the dimension, and bottom out at zero', () => {
  for (const spec of specs) {
    for (const d of spec.dimensions) {
      const bands = d.bands
      assert.ok(bands.length >= 2, `${spec.key} ${d.id} needs at least two bands`)
      for (const b of bands) {
        assert.ok(b.min <= b.max, `${spec.key} ${d.id} band ${b.name} is inverted`)
        assert.ok(b.min >= 0 && b.max <= d.max, `${spec.key} ${d.id} band ${b.name} escapes 0..${d.max}`)
      }
      for (let i = 1; i < bands.length; i++) {
        assert.ok(bands[i].max < bands[i - 1].min, `${spec.key} ${d.id} bands overlap or are out of order`)
      }
      assert.equal(bands[0].max, d.max, `${spec.key} ${d.id} top band should reach the maximum`)
      assert.equal(bands.at(-1)!.min, 0, `${spec.key} ${d.id} bottom band should reach zero`)
    }
  }
})

test('coaching scores exact values, kickoff scores ranges', () => {
  // Coaching's preamble forbids interpolation, so every band is a single number.
  for (const d of RUBRICS.coaching.dimensions) {
    for (const b of d.bands) assert.equal(b.min, b.max, `coaching ${d.id} ${b.name} should be exact`)
  }
  // Kick-off scores in bands. These five print real ranges in the file.
  const ranged = RUBRICS.kickoff.dimensions.filter((d) => d.bands.some((b) => b.min !== b.max))
  assert.deepEqual(ranged.map((d) => d.id), ['D1', 'D3', 'D5', 'D10', 'D12'])
})

test('every cap points at a dimension that exists and a max it could reach', () => {
  for (const spec of specs) {
    for (const cap of spec.caps) {
      if (cap.kind !== 'dimension') continue
      const d = spec.dimensions.find((x) => x.id === cap.dimension)
      assert.ok(d, `${spec.key} cap ${cap.id} points at missing ${cap.dimension}`)
      assert.ok(cap.max <= d!.max, `${spec.key} cap ${cap.id} caps above the dimension maximum`)
      assert.ok(
        allowedScores(d!).includes(cap.max),
        `${spec.key} cap ${cap.id} clamps to ${cap.max}, which ${cap.dimension} cannot score`,
      )
    }
    assert.ok(new Set(spec.caps.map((c) => c.id)).size === spec.caps.length, `${spec.key} duplicate cap ids`)
  }
})

test('the conditional dimensions are D2 and D4, and only on coaching', () => {
  // Kick-off's own preamble says "all twelve dimensions active".
  assert.equal(RUBRICS.kickoff.dimensions.filter((d) => d.optional).length, 0)
  // Coaching has two, for different reasons: D2 diagnostics only run at weeks 8/16/24, and D4
  // movement coaching switches off when no movement happened. Both leave the denominator.
  assert.deepEqual(
    RUBRICS.coaching.dimensions.filter((d) => d.optional).map((d) => d.id),
    ['D2', 'D4'],
  )
})

test('overall bands descend and cover every score from 0 to 100', () => {
  for (const spec of specs) {
    const mins = spec.bands.map((b) => b.min)
    assert.deepEqual(mins, [...mins].sort((a, b) => b - a), `${spec.key} bands out of order`)
    assert.equal(mins.at(-1), 0, `${spec.key} has a score with no band`)
    for (let p = 0; p <= 100; p++) assert.ok(overallBandFor(spec, p), `${spec.key} has no band for ${p}`)
  }
})

/* ------------------------------------------------------------------ *
 * Behaviour of the helpers.
 * ------------------------------------------------------------------ */

test('allowedScores walks a range in the step size the rubric permits', () => {
  const k = RUBRICS.kickoff.dimensions
  // max 10, so whole integers only, and the bands cover every one of them
  assert.deepEqual(allowedScores(k[0]), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
  // max 5, so half steps, and the gaps at 4 and 0.5 are preserved
  assert.deepEqual(allowedScores(k[2]), [5, 4.5, 3.5, 3, 2.5, 2, 1.5, 1, 0])
})

test('allowedScores on an exact-value rubric returns just those values', () => {
  const c = RUBRICS.coaching.dimensions
  assert.deepEqual(allowedScores(c[0]), [10, 7, 3, 0])
  assert.deepEqual(allowedScores(c[9]), [5, 0])
})

test('bandFor labels a score, and refuses one that falls in a gap', () => {
  const d3 = RUBRICS.kickoff.dimensions[2]
  assert.equal(bandFor(d3, 5)?.name, 'Elite')
  assert.equal(bandFor(d3, 3)?.name, 'Mid')
  assert.equal(bandFor(d3, 4), undefined, '4 sits between Mid and Elite and belongs to neither')
  assert.equal(bandFor(RUBRICS.coaching.dimensions[0], 5), undefined, 'coaching allows 10, 7, 3 or 0')
})

test('the overall band boundary is inclusive at the bottom', () => {
  const k = RUBRICS.kickoff
  assert.equal(overallBandFor(k, 70), 'Inconsistent')
  assert.equal(overallBandFor(k, 69), 'At risk')
  assert.equal(overallBandFor(k, 90), 'Elite')
  assert.equal(overallBandFor(k, 100), 'Elite')
  assert.equal(overallBandFor(k, 0), 'Fail')
})

/* ------------------------------------------------------------------ *
 * The spec above was typed by hand from the client's markdown. This
 * reads those files back and proves the two agree, so a mistyped
 * number fails a test instead of silently mis-scoring a coach.
 * ------------------------------------------------------------------ */

const DASH = '[-‐-―]'

function parseRubricFile(file: string) {
  const text = readFileSync(join(process.cwd(), 'rubrics', file), 'utf8')
  const parsed: { id: string; name: string; max: number; bands: { name: string; min: number; max: number }[] }[] = []
  let current: (typeof parsed)[number] | null = null

  for (const line of text.split('\n')) {
    const heading = line.trim().match(new RegExp(`^### Dimension (\\d+) ${DASH} (.+?) \\((\\d+) pts\\)`))
    if (heading) {
      current = { id: `D${heading[1]}`, name: heading[2].trim(), max: Number(heading[3]), bands: [] }
      parsed.push(current)
      continue
    }
    // A "## " heading ends the dimension tables, so the overall band table is not swept up.
    if (line.startsWith('## ')) { current = null; continue }
    if (!current || !line.trim().startsWith('|')) continue

    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim().replace(/\*\*/g, '').trim())

    // Range format:  | Elite | 9-10 | criteria |
    const range = cells[1]?.match(new RegExp(`^(\\d+(?:\\.\\d+)?)(?:${DASH}(\\d+(?:\\.\\d+)?))?$`))
    if (cells.length >= 3 && range) {
      parsed.at(-1)!.bands.push({ name: cells[0], min: Number(range[1]), max: Number(range[2] ?? range[1]) })
      continue
    }
    // Exact format:  | 10/10 - Elite | criteria |
    const exact = cells[0]?.match(new RegExp(`^(\\d+(?:\\.\\d+)?)/(\\d+)\\s*${DASH}\\s*(\\S+)`))
    if (exact) {
      const value = Number(exact[1])
      parsed.at(-1)!.bands.push({ name: exact[3], min: value, max: value })
    }
  }
  return parsed
}

for (const spec of specs) {
  test(`${spec.key} spec matches rubrics/${spec.markdownFile}`, () => {
    const fromFile = parseRubricFile(spec.markdownFile)
    assert.equal(fromFile.length, 12, 'parsed a different number of dimensions')

    for (const [i, parsed] of fromFile.entries()) {
      const mine = spec.dimensions[i]
      assert.equal(mine.id, parsed.id)
      assert.equal(mine.name, parsed.name, `${parsed.id} name`)
      assert.equal(mine.max, parsed.max, `${parsed.id} maximum`)
      assert.deepEqual(
        mine.bands.map((b) => [b.name, b.min, b.max]),
        parsed.bands.map((b) => [b.name, b.min, b.max]),
        `${parsed.id} bands do not match the file`,
      )
    }
  })
}
