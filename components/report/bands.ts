/**
 * One accent per band name, on each of the two grounds.
 *
 * Two vocabularies land here and both must be covered, or the page ends up half-coloured, which
 * reads as a bug rather than as restraint:
 *
 *   the call's overall band   Elite · Strong · Inconsistent · At risk · Fail
 *   a dimension's own band    Elite · Strong · Mid · Surface · Weak · Fail
 *
 * Mapped by severity so green always means good on either ground.
 */
const ON_PAPER: Record<string, string> = {
  Elite: 'var(--color-band-elite)',
  Strong: 'var(--color-band-strong)',
  Inconsistent: 'var(--color-band-inconsistent)',
  Mid: 'var(--color-band-inconsistent)',
  Surface: 'var(--color-band-inconsistent)',
  'At risk': 'var(--color-band-atrisk)',
  Weak: 'var(--color-band-atrisk)',
  Fail: 'var(--color-band-fail)',
}

/** The same five judgements, lifted to carry on the dark rail. */
const ON_RAIL: Record<string, string> = {
  Elite: 'var(--color-lit-elite)',
  Strong: 'var(--color-lit-strong)',
  Inconsistent: 'var(--color-lit-inconsistent)',
  Mid: 'var(--color-lit-inconsistent)',
  Surface: 'var(--color-lit-inconsistent)',
  'At risk': 'var(--color-lit-atrisk)',
  Weak: 'var(--color-lit-atrisk)',
  Fail: 'var(--color-lit-fail)',
}

export function bandColour(band: string | null): string {
  return (band && ON_PAPER[band]) || 'var(--color-ink)'
}

export function litBandColour(band: string | null): string {
  return (band && ON_RAIL[band]) || 'var(--color-rail-ink)'
}

/** Every band name either rubric can produce, so a test can prove none fall through. */
export const KNOWN_BANDS = Object.keys(ON_PAPER)
