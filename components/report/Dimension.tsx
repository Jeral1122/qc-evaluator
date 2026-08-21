import type { ScoredDimension } from '@/lib/scoring/total.ts'
import { bandColour } from './bands.ts'

/**
 * One of the twelve, collapsed to a row and openable to its reasoning.
 *
 * Built on <details>, which is a native browser element. No state, no JavaScript, no library:
 * it opens on click on its own and it prints in whatever state it is left in. The print route
 * passes `open`, which is the entire mechanism for a PDF that shows everything.
 *
 * Three states have to look different from each other, and this is the part most likely to
 * mislead a coach if it is got wrong:
 *
 *   scored          a number out of its own maximum
 *   not evidenced   the same number, plus a line saying it rests on absence
 *   not applicable  N/A, greyed, and visibly outside the total
 *
 * A coach seeing 0/15 next to "Movement Coaching" should never think they failed at something
 * the call was never meant to contain.
 */
export function Dimension({ d, open = false }: { d: ScoredDimension; open?: boolean }) {
  return (
    <details open={open} className="avoid-break group border-b border-rule">
      <summary className="flex cursor-pointer items-baseline gap-4 py-4 hover:bg-black/[0.015]">
        <span className="w-8 shrink-0 text-xs text-ink-faint">{d.id}</span>

        <span className="flex-1 text-[0.95rem] leading-snug">
          {d.name}
          {d.notEvidenced && !d.disabled && (
            <span className="ml-2 text-xs text-ink-faint">not evidenced</span>
          )}
        </span>

        {d.disabled ? (
          <span className="shrink-0 text-sm text-ink-faint">N/A</span>
        ) : (
          <>
            <span
              className="hidden w-24 shrink-0 text-right text-xs sm:block"
              style={{ color: bandColour(d.band) }}
            >
              {d.band}
            </span>
            <span className="w-16 shrink-0 text-right font-display text-lg">
              {d.score}
              <span className="text-ink-faint">/{d.max}</span>
            </span>
          </>
        )}

        {/* Drawn rather than using the OS triangle, which looks like a form control. */}
        <svg
          className="ml-1 h-3 w-3 shrink-0 text-ink-faint transition-transform group-open:rotate-90"
          viewBox="0 0 12 12" fill="none" aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </summary>

      <div className="max-w-[62ch] pb-8 pl-12 text-[0.9rem] leading-relaxed text-ink-soft">
        {d.disabled ? (
          <p>
            <span className="text-ink">Not scored on this call.</span> {d.disabledReason}{' '}
            Its {d.max} points were removed from the total rather than counted against the coach.
          </p>
        ) : (
          <>
            {d.cappedBy && (
              <p className="mb-4" style={{ color: 'var(--color-band-atrisk)' }}>
                Capped from {d.scoreBeforeCap} to {d.score} by an automatic rule.
              </p>
            )}

            <p>{d.reasoning}</p>

            {d.evidence.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="label">From the transcript</p>
                {d.evidence.map((quote, i) => (
                  <blockquote key={i} className="evidence py-2 pl-4 pr-3 text-[0.85rem]">
                    {quote}
                  </blockquote>
                ))}
              </div>
            )}

            {d.quickFix && (
              <div className="mt-4">
                <p className="label">Quick fix</p>
                <p className="mt-1">{d.quickFix}</p>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  )
}
