import type { RubricSpec } from './types.ts'

/**
 * The kick-off call rubric, transcribed from `rubrics/kickoff-call-rubric.md`.
 *
 * Two things about this rubric that the coaching one does not share:
 *
 * 1. It scores in BANDS, not exact values. Its own preamble says a score "must fall inside one
 *    of the bands listed in its table. Within a band, any integer works (or a half step where
 *    the dimension's max is 5 or less)."
 *
 * 2. Five dimensions (D1, D3, D5, D10, D12) print ranges. The other seven print a single value
 *    per band. For those seven the band is that one value, because inventing a boundary the
 *    client never wrote would be guessing, and this system does not guess.
 *
 * D3, D10 and D12 have deliberate GAPS. D3 jumps from "Mid 2.5-3.5" to "Elite 4.5-5", so a
 * score of 4 belongs to no band and is rejected. The gap is the client's, so it is preserved.
 */
export const kickoff: RubricSpec = {
  key: 'kickoff',
  title: 'Kick-off call',
  markdownFile: 'kickoff-call-rubric.md',

  dimensions: [
    {
      id: 'D1',
      name: 'Pre-Call Preparation',
      max: 10,
      bands: [
        { name: 'Elite', min: 9, max: 10 },
        { name: 'Strong', min: 6, max: 8 },
        { name: 'Mid', min: 4, max: 5 },
        { name: 'Weak', min: 1, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D2',
      name: 'Rapport & Tone',
      max: 10,
      bands: [
        { name: 'Elite', min: 10, max: 10 },
        { name: 'Strong', min: 7, max: 7 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D3',
      name: 'Agenda Framing',
      max: 5,
      bands: [
        { name: 'Elite', min: 4.5, max: 5 },
        { name: 'Mid', min: 2.5, max: 3.5 },
        { name: 'Weak', min: 1, max: 2 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D4',
      name: 'Goal Alignment & Deep Why',
      max: 15,
      bands: [
        { name: 'Elite', min: 15, max: 15 },
        { name: 'Strong', min: 10, max: 10 },
        { name: 'Mid', min: 5, max: 5 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D5',
      name: 'Program Explanation (3 Phases)',
      max: 10,
      bands: [
        { name: 'Elite', min: 9, max: 10 },
        { name: 'Strong', min: 6, max: 8 },
        { name: 'Mid', min: 3, max: 5 },
        { name: 'Weak', min: 1, max: 2 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D6',
      name: 'Journey & Expectation Setting',
      max: 10,
      bands: [
        { name: 'Elite', min: 10, max: 10 },
        { name: 'Strong', min: 7, max: 7 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D7',
      name: 'Support System Clarity',
      max: 5,
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D8',
      name: 'Coaching Intelligence Questions',
      max: 10,
      bands: [
        { name: 'Elite', min: 10, max: 10 },
        { name: 'Strong', min: 7, max: 7 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D9',
      name: 'Next Steps & Diagnostics',
      max: 10,
      bands: [
        { name: 'Elite', min: 10, max: 10 },
        { name: 'Strong', min: 7, max: 7 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D10',
      name: 'Booking Next Call',
      max: 5,
      bands: [
        { name: 'Elite', min: 4.5, max: 5 },
        { name: 'Mid', min: 2.5, max: 3.5 },
        { name: 'Weak', min: 1, max: 2 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D11',
      name: 'Close, Recap & Confidence',
      max: 5,
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D12',
      name: 'Post-Call Execution',
      max: 5,
      bands: [
        { name: 'Elite', min: 4.5, max: 5 },
        { name: 'Strong', min: 3.5, max: 4 },
        { name: 'Mid', min: 2, max: 3 },
        { name: 'Weak', min: 1, max: 1 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
  ],

  // Checked before scoring. Three cap the whole call, one caps a single dimension.
  caps: [
    {
      id: 'no-followup-questions',
      kind: 'total',
      max: 70,
      condition: 'No follow-up questions anywhere in the call',
    },
    {
      id: 'coach-monologue',
      kind: 'total',
      max: 80,
      condition: 'Coach speaks >70% of the time without client engagement',
    },
    {
      id: 'unresolved-confusion',
      kind: 'total',
      max: 75,
      condition: 'Client shows unresolved confusion at any point',
    },
    {
      id: 'no-north-star',
      kind: 'dimension',
      dimension: 'D4',
      max: 10,
      condition: 'No North Star statement constructed',
    },
  ],

  bands: [
    { name: 'Elite', min: 90 },
    { name: 'Strong', min: 80 },
    { name: 'Inconsistent', min: 70 },
    { name: 'At risk', min: 60 },
    { name: 'Fail', min: 0 },
  ],
}
