import type { RubricSpec } from './types.ts'

/**
 * The coaching call rubric, transcribed from `rubrics/coaching-call-rubric.md`.
 *
 * Differs from kick-off in three ways that matter:
 *
 * 1. EXACT VALUES, not ranges. Its preamble: "Each dimension's score must be exactly one of the
 *    bucket values listed in its table. No interpolation." So every band here has min === max.
 *
 * 2. The maximums sum to 105, not 100. The rubric's own prose says the total is 100 with D4
 *    active and 85 without, but 12 dimensions summing to 105 minus D4's 15 is 90. The file
 *    contradicts itself by 5 points either way. We normalise against the summed maximums instead
 *    of trusting either number, so the maths is consistent whichever was meant. See ARCHITECTURE.md.
 *
 * 3. D4 is optional. When a call contains no movement coaching at all, D4 leaves both sides of
 *    the fraction rather than scoring zero. A strategy-only call has not failed at movement work,
 *    it simply did not contain any.
 */
export const coaching: RubricSpec = {
  key: 'coaching',
  title: 'Coaching call',
  markdownFile: 'coaching-call-rubric.md',

  dimensions: [
    {
      id: 'D1',
      name: 'Check-In & Connection',
      max: 10,
      bands: [
        { name: 'Elite', min: 10, max: 10 },
        { name: 'Strong', min: 7, max: 7 },
        { name: 'Surface', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D2',
      name: 'Diagnostics Review',
      max: 10,
      bands: [
        { name: 'Elite', min: 10, max: 10 },
        { name: 'Strong', min: 7, max: 7 },
        { name: 'Surface', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D3',
      name: 'Program Focus + Vision',
      max: 15,
      bands: [
        { name: 'Elite', min: 15, max: 15 },
        { name: 'Strong', min: 10, max: 10 },
        { name: 'Mid', min: 5, max: 5 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D4',
      name: 'Movement Coaching Quality',
      max: 15,
      optional: true,
      bands: [
        { name: 'Elite', min: 15, max: 15 },
        { name: 'Strong', min: 10, max: 10 },
        { name: 'Mid', min: 5, max: 5 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D5',
      name: 'Adjustments & Strategy',
      max: 10,
      bands: [
        { name: 'Elite', min: 10, max: 10 },
        { name: 'Strong', min: 7, max: 7 },
        { name: 'Surface', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D6',
      name: 'Action Steps & Accountability',
      max: 15,
      bands: [
        { name: 'Elite', min: 15, max: 15 },
        { name: 'Strong', min: 10, max: 10 },
        { name: 'Mid', min: 5, max: 5 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D7',
      name: 'Accountability Anchor',
      max: 5,
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D8',
      name: 'Struggle Handling',
      max: 5,
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D9',
      name: 'Close Quality',
      max: 5,
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D10',
      name: 'Next Call Booking',
      max: 5,
      // Only two outcomes. It was booked live on the call, or it was not.
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D11',
      name: 'Continuity & Follow-Up Clarity',
      max: 5,
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
    {
      id: 'D12',
      name: 'Structure & Time Management',
      max: 5,
      bands: [
        { name: 'Elite', min: 5, max: 5 },
        { name: 'Mid', min: 3, max: 3 },
        { name: 'Fail', min: 0, max: 0 },
      ],
    },
  ],

  caps: [
    {
      id: 'next-call-not-booked',
      kind: 'dimension',
      dimension: 'D10',
      max: 0,
      condition: 'Next call NOT booked live during the call (non-recoverable)',
    },
    {
      id: 'no-vision-connection',
      kind: 'dimension',
      dimension: 'D3',
      max: 10,
      condition: 'No connection to long-term vision at any point in the call',
    },
    {
      id: 'coach-monologue',
      kind: 'total',
      max: 75,
      condition: 'Coach speaks >75% of the call, client passive',
    },
    {
      id: 'no-accountability-commitment',
      kind: 'dimension',
      dimension: 'D6',
      max: 10,
      condition: 'No concrete accountability commitment the client owns before close',
    },
    {
      id: 'struggle-ignored',
      kind: 'dimension',
      dimension: 'D8',
      max: 0,
      condition: 'Client struggle present but ignored or avoided (non-recoverable)',
    },
    {
      id: 'no-action-steps',
      kind: 'total',
      max: 70,
      condition: 'No action steps stated for either party before close',
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
