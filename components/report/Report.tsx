import type { Run } from '@/lib/types.ts'
import { Dimension } from './Dimension.tsx'
import { litBandColour } from './bands.ts'
import { BandScale } from './BandScale.tsx'
import { DownloadButton } from './DownloadButton.tsx'
import { Shell, Wordmark } from '../Shell.tsx'

/**
 * The whole report.
 *
 * The SAME component renders the screen and the PDF. That is the entire reason the print route
 * is a route rather than a second renderer: two renderings of one report is how a PDF ends up
 * quietly disagreeing with the page it claims to mirror. `forPrint` opens the twelve dimensions
 * and drops the interactive chrome; the stylesheet folds the rail into ink on white.
 *
 * The rail holds the verdict, the reading column holds the argument. A coach scrolling through
 * twelve dimensions never loses sight of the number those dimensions produced.
 *
 * Block order in the column is the client's, not mine: the fix first, then the summary, then
 * the risks, then the detail. A coach who reads only the top still leaves with the one thing.
 */
export function Report({ run, forPrint = false }: { run: Run; forPrint?: boolean }) {
  const report = run.report!
  const { scoring } = report
  const accent = litBandColour(scoring.band)

  const assessed = new Date(report.scoredAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // A cap that held but took nothing is not worth a coach's attention.
  const capsThatCost = scoring.capsFired.filter((c) => c.changedTheOutcome)

  const rail = (
    <>
      <Wordmark context={report.rubricTitle} />

      <div>
        <p className="rail-soft text-sm text-rail-soft">
          {[run.coach_name && `Coach ${run.coach_name}`, run.client_name && `Client ${run.client_name}`]
            .filter(Boolean)
            .join('  ·  ') || 'Names not recorded'}
        </p>
        <p className="rail-soft mt-1 text-xs text-rail-faint">Assessed {assessed}</p>
      </div>

      <div className="verdict-score">
        <div className="flex items-end gap-4">
          <span className="font-display text-[5.5rem] leading-[0.8] tracking-tight" style={{ color: accent }}>
            {scoring.percent}
          </span>
          <span className="pb-1.5 font-display text-2xl leading-none" style={{ color: accent }}>
            {scoring.band}
          </span>
        </div>
        <p className="rail-soft mt-3 text-xs text-rail-faint">
          {scoring.denominator === 100
            ? `${scoring.raw} points out of 100`
            : `${scoring.raw} of the ${scoring.denominator} points this call could earn, shown out of 100`}
        </p>
      </div>

      {scoring.bands?.length > 0 && (
        <BandScale percent={scoring.percent} band={scoring.band} bands={scoring.bands} />
      )}

      {scoring.projected && (
        <p className="rail-soft text-sm text-rail-soft">
          Would be{' '}
          <span style={{ color: litBandColour(scoring.projected.band) }}>{scoring.projected.percent}</span>{' '}
          with the one thing fixed.
        </p>
      )}

      {/* A capped 70 and an earned 70 are different calls, and only one is the coach's fault. */}
      {capsThatCost.length > 0 && (
        <div className="border-t border-rail-rule pt-5">
          <p className="label-rail" style={{ color: litBandColour('At risk') }}>
            {capsThatCost.length === 1 ? 'A ceiling applied' : 'Ceilings applied'}
          </p>
          <ul className="mt-3 space-y-3">
            {capsThatCost.map((cap) => (
              <li key={cap.id} className="rail-soft text-sm leading-relaxed text-rail-soft">
                <span className="rail-strong">{cap.condition}</span>{' '}
                {cap.kind === 'total' ? `holds this call at ${cap.max}.` : `caps ${cap.dimension} at ${cap.max}.`}{' '}
                {cap.why}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-6">
        {!forPrint && <DownloadButton runId={run.id} />}
        <p className="rail-soft mt-4 text-[0.7rem] leading-relaxed text-rail-faint">
          Every quote in this report was checked word for word against the transcript.
        </p>
      </div>
    </>
  )

  return (
    <Shell rail={rail}>
      <article>
        <section className="avoid-break">
          <p className="label">The one thing</p>
          <p className="mt-4 font-display text-[1.9rem] leading-[1.25] tracking-tight sm:text-[2.15rem]">
            {report.oneThing.change}
          </p>
          {report.oneThing.why && (
            <p className="mt-5 max-w-[68ch] text-[0.975rem] leading-[1.7] text-ink-soft">
              {report.oneThing.why}
            </p>
          )}
        </section>

        <section className="avoid-break mt-14 border-t border-rule pt-10">
          <p className="label">The brief</p>
          <p className="mt-4 max-w-[68ch] whitespace-pre-line text-[0.975rem] leading-[1.7]">
            {report.brief}
          </p>
        </section>

        <section className="avoid-break mt-14 border-t border-rule pt-10">
          <p className="label">Red flags</p>
          {report.redFlags.length === 0 ? (
            <p className="mt-4 text-[0.975rem] text-ink-soft">
              Nothing here puts this client at risk of leaving.
            </p>
          ) : (
            <ul className="mt-5 space-y-6">
              {report.redFlags.map((flag, i) => (
                <li key={i} className="max-w-[68ch]">
                  <p className="text-[0.975rem] leading-snug" style={{ color: 'var(--color-band-fail)' }}>
                    {flag.flag}
                  </p>
                  <p className="mt-1.5 text-[0.9rem] leading-[1.7] text-ink-soft">{flag.why}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-14 border-t border-rule pt-10">
          <p className="label mb-1">Dimensions</p>
          {scoring.dimensions.map((d) => (
            <Dimension key={d.id} d={d} open={forPrint} />
          ))}
        </section>

        <footer className="pt-8 text-[0.7rem] text-ink-faint">Reference {run.id}</footer>
      </article>
    </Shell>
  )
}
