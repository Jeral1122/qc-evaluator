import type { Run } from '@/lib/types.ts'
import { Dimension } from './Dimension.tsx'
import { bandColour } from './bands.ts'
import { DownloadButton } from './DownloadButton.tsx'

/**
 * The whole report.
 *
 * The SAME component renders the screen and the PDF. That is the entire reason the print route
 * exists as a route rather than as a second renderer: two renderings of one report is how a PDF
 * ends up quietly disagreeing with the page it claims to mirror.
 *
 * `forPrint` opens every dimension and drops the interactive chrome. Nothing else differs.
 *
 * Block order is the client's, not mine. It is the order the coach reads in: the fix first,
 * then the summary, then the risks, then the detail. A coach who reads only the top of the page
 * still leaves with the one thing that matters.
 */
export function Report({ run, forPrint = false }: { run: Run; forPrint?: boolean }) {
  const report = run.report!
  const { scoring } = report
  const accent = bandColour(scoring.band)

  const assessed = new Date(report.scoredAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // A cap that was true but took nothing is not worth a coach's attention.
  const capsThatCost = scoring.capsFired.filter((c) => c.changedTheOutcome)

  return (
    <article className="mx-auto max-w-[42rem] px-6 pb-24 pt-12 sm:px-8">
      {/* ---- masthead ---- */}
      <header className="flex items-start justify-between gap-6 border-b border-rule pb-6">
        <div>
          <p className="eyebrow">{report.rubricTitle}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {[run.coach_name && `Coach ${run.coach_name}`, run.client_name && `Client ${run.client_name}`]
              .filter(Boolean)
              .join('  ·  ') || 'Names not recorded'}
          </p>
          <p className="mt-1 text-xs text-ink-faint">Assessed {assessed}</p>
        </div>
        {!forPrint && <DownloadButton runId={run.id} />}
      </header>

      {/* ---- the number ---- */}
      <section className="avoid-break border-b border-rule py-10">
        <div className="flex items-end gap-6">
          <div className="font-display text-7xl leading-none" style={{ color: accent }}>
            {scoring.percent}
          </div>
          <div className="pb-1">
            <div className="font-display text-2xl leading-none" style={{ color: accent }}>
              {scoring.band}
            </div>
            <div className="mt-2 text-xs text-ink-faint">
              {scoring.raw} of {scoring.denominator} points available
              {scoring.denominator !== 100 && ', normalised to 100'}
            </div>
          </div>
        </div>

        {scoring.projected && (
          <p className="mt-5 text-sm text-ink-soft">
            Would be{' '}
            <span className="font-display text-base" style={{ color: bandColour(scoring.projected.band) }}>
              {scoring.projected.percent}
            </span>{' '}
            with the one thing below fixed.
          </p>
        )}

        {/* A capped 70 and an earned 70 are different calls. Saying which is not optional. */}
        {capsThatCost.length > 0 && (
          <div className="mt-6 border-l-2 border-band-atrisk pl-4">
            <p className="eyebrow" style={{ color: 'var(--color-band-atrisk)' }}>
              {capsThatCost.length === 1 ? 'A ceiling applied' : 'Ceilings applied'}
            </p>
            <ul className="mt-2 space-y-2 text-sm text-ink-soft">
              {capsThatCost.map((cap) => (
                <li key={cap.id}>
                  <span className="text-ink">{cap.condition}</span>
                  <span className="text-ink-faint">
                    {' '}— {cap.kind === 'total' ? `holds this call at ${cap.max}` : `caps ${cap.dimension} at ${cap.max}`}.
                  </span>{' '}
                  {cap.why}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---- the one thing ---- */}
      <section className="avoid-break border-b border-rule py-10">
        <p className="eyebrow">The one thing</p>
        <p className="mt-3 max-w-[60ch] font-display text-2xl leading-snug">{report.oneThing.change}</p>
        {report.oneThing.why && (
          <p className="mt-4 max-w-[62ch] text-[0.95rem] leading-relaxed text-ink-soft">
            {report.oneThing.why}
          </p>
        )}
      </section>

      {/* ---- the brief ---- */}
      <section className="avoid-break border-b border-rule py-10">
        <p className="eyebrow">The brief</p>
        <p className="mt-3 max-w-[62ch] whitespace-pre-line text-[0.95rem] leading-relaxed">
          {report.brief}
        </p>
      </section>

      {/* ---- red flags ---- */}
      <section className="avoid-break border-b border-rule py-10">
        <p className="eyebrow">Red flags</p>
        {report.redFlags.length === 0 ? (
          <p className="mt-3 text-[0.95rem] text-ink-soft">
            Nothing here puts this client at risk of leaving.
          </p>
        ) : (
          <ul className="mt-4 space-y-5">
            {report.redFlags.map((flag, i) => (
              <li key={i} className="max-w-[62ch] border-l-2 border-band-fail pl-4">
                <p className="text-[0.95rem] leading-snug">{flag.flag}</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">{flag.why}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- the twelve ---- */}
      <section className="pt-10">
        <p className="eyebrow mb-2">Dimensions</p>
        {scoring.dimensions.map((d) => (
          <Dimension key={d.id} d={d} open={forPrint} />
        ))}
      </section>

      <footer className="pt-8 text-xs text-ink-faint">
        Scored against {report.rubricTitle.toLowerCase()} rubric · {report.model} · run {run.id}
      </footer>
    </article>
  )
}
