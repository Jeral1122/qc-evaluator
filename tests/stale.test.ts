import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStaleRun, STALE_AFTER_MS, SCORING_MAX_DURATION_SECONDS } from '../lib/scoring/run.ts'

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const now = () => new Date().toISOString()

test('the threshold outlives the function it is watching', () => {
  // Set this below the duration limit and a healthy job gets reaped mid-flight, which would be
  // worse than the bug it exists to fix.
  assert.ok(STALE_AFTER_MS > SCORING_MAX_DURATION_SECONDS * 1000)
  // And longer than the slowest run measured against the real transcripts, with room.
  assert.ok(STALE_AFTER_MS > 181_700 * 1.5)
})

test('a job that just started is alive', () => {
  assert.equal(isStaleRun({ status: 'running', started_at: now(), created_at: now() }), false)
})

test('a job still running at two minutes is alive, because that is normal here', () => {
  assert.equal(
    isStaleRun({ status: 'running', started_at: ago(120_000), created_at: ago(121_000) }),
    false,
  )
})

test('a job still running past the threshold is dead', () => {
  assert.ok(isStaleRun({ status: 'running', started_at: ago(STALE_AFTER_MS + 1000), created_at: ago(999_999) }))
})

test('a run stuck in queued is dead too, and the clock runs from creation', () => {
  // started_at is only stamped when a worker claims the row. A run that was never claimed has
  // no started_at, and sitting in queued forever is just as dead as hanging in running.
  assert.ok(isStaleRun({ status: 'queued', started_at: null, created_at: ago(STALE_AFTER_MS + 1000) }))
  assert.equal(isStaleRun({ status: 'queued', started_at: null, created_at: now() }), false)
})

test('a finished run is never reaped, however old', () => {
  const ancient = { started_at: ago(99_999_999), created_at: ago(99_999_999) }
  assert.equal(isStaleRun({ status: 'complete', ...ancient }), false)
  assert.equal(isStaleRun({ status: 'failed', ...ancient }), false)
})
