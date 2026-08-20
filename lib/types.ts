import type { RubricKey } from './rubrics/types.ts'
import type { Scoring } from './scoring/total.ts'

export type RunStatus = 'queued' | 'running' | 'complete' | 'failed'

/** A row of the `runs` table. */
export type Run = {
  id: string
  rubric_key: RubricKey
  client_name: string | null
  coach_name: string | null
  transcript: string
  status: RunStatus
  error_reason: string | null
  report: StoredReport | null
  total_score: number | null
  band: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

/**
 * What lands in the `report` JSONB column.
 *
 * Everything the page needs to render, with nothing left to recompute at read time. The scoring
 * is a record of what this rubric said on this day, so it is frozen here rather than derived
 * again later from a rubric file that might have changed.
 */
export type StoredReport = {
  rubricKey: RubricKey
  rubricTitle: string
  model: string
  scoredAt: string
  scoring: Scoring
  oneThing: { change: string; why: string; ifFixed: { dimension: string; score: number } }
  brief: string
  redFlags: { flag: string; why: string }[]
}
