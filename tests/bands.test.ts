import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RUBRICS } from '../lib/rubrics/index.ts'
import { KNOWN_BANDS } from '../components/report/bands.ts'

test('every band either rubric can produce has a colour', () => {
  // Without this, a band name that exists only in one dimension of one rubric renders in plain
  // ink while its neighbours are coloured, and the page looks broken rather than restrained.
  const used = new Set<string>()
  for (const rubric of Object.values(RUBRICS)) {
    for (const d of rubric.dimensions) for (const b of d.bands) used.add(b.name)
    for (const b of rubric.bands) used.add(b.name)
  }

  const uncoloured = [...used].filter((name) => !KNOWN_BANDS.includes(name))
  assert.deepEqual(uncoloured, [], `no colour defined for: ${uncoloured.join(', ')}`)
})
