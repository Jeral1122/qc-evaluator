/**
 * One accent colour per band name.
 *
 * Two different vocabularies land here and both have to be covered, or the page ends up
 * half-coloured, which reads as a bug rather than as restraint:
 *
 *   the call's overall band   Elite · Strong · Inconsistent · At risk · Fail
 *   a dimension's own band    Elite · Strong · Mid · Surface · Weak · Fail
 *
 * Five colours, shared across both scales by severity, so green always means good and red
 * always means missing no matter which scale is being read.
 */
const BAND_COLOURS: Record<string, string> = {
  Elite: 'var(--color-band-elite)',
  Strong: 'var(--color-band-strong)',

  Inconsistent: 'var(--color-band-inconsistent)',
  Mid: 'var(--color-band-inconsistent)',
  Surface: 'var(--color-band-inconsistent)',

  'At risk': 'var(--color-band-atrisk)',
  Weak: 'var(--color-band-atrisk)',

  Fail: 'var(--color-band-fail)',
}

/** Falls back to plain ink rather than inventing a colour for a band we have never seen. */
export function bandColour(band: string | null): string {
  return (band && BAND_COLOURS[band]) || 'var(--color-ink)'
}

/** Every band name either rubric can produce, so a test can prove none of them fall through. */
export const KNOWN_BANDS = Object.keys(BAND_COLOURS)
