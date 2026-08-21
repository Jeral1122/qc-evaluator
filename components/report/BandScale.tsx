import type { OverallBand } from '@/lib/rubrics/types.ts'
import { litBandColour } from './bands.ts'

/**
 * Where this call sits on the rubric's own scale.
 *
 * The number says how they did. This says how close they came, which is the question a coach
 * asks half a second later. It also makes the grading visible without a word of explanation:
 * Fail owns sixty of the hundred points, so the four bands that matter are squeezed into the
 * last forty, and you can see that before you read anything.
 *
 * Not a progress bar. Nothing is filling toward 100; a scale is being read, and the tick is the
 * reading.
 */
export function BandScale({
  percent, band, bands,
}: { percent: number; band: string; bands: OverallBand[] }) {
  // The rubric lists bands highest first; left-to-right wants the reverse.
  const ascending = [...bands].sort((a, b) => a.min - b.min)

  const segments = ascending.map((b, i) => ({
    name: b.name,
    min: b.min,
    width: ((ascending[i + 1]?.min ?? 101) - b.min) / 101 * 100,
  }))

  const next = ascending[ascending.findIndex((b) => b.name === band) + 1]
  const pointsAway = next ? next.min - percent : null

  return (
    <div className="keep-colour">
      <div className="verdict-scale relative">
        <div
          className="flex h-1.5 w-full gap-[3px]"
          role="img"
          aria-label={`${percent} out of 100, in the ${band} band`}
        >
          {segments.map((s) => (
            <div
              key={s.name}
              style={{
                width: `${s.width}%`,
                backgroundColor: litBandColour(s.name),
                // Every band is drawn; only the one this call landed in is lit. The eye finds
                // the answer before it reads a number.
                opacity: s.name === band ? 1 : 0.3,
              }}
            />
          ))}
        </div>

        {/* Without this the band is lit but the score inside it is invisible: 90 and 100 look
            identical. */}
        <span
          className="verdict-tick absolute -top-[0.3rem] flex h-[1.6rem] w-[5px] justify-center bg-rail"
          style={{ left: `calc(${(percent / 101) * 100}% - 2.5px)` }}
          aria-hidden="true"
        >
          <span className="h-full w-px bg-rail-ink" />
        </span>
      </div>

      <div className="relative mt-2 h-4">
        {segments.slice(1).map((s) => (
          <span
            key={s.name}
            className="rail-soft absolute -translate-x-1/2 text-[0.65rem] tabular-nums text-rail-faint"
            style={{ left: `${(s.min / 101) * 100}%` }}
          >
            {s.min}
          </span>
        ))}
      </div>

      {pointsAway !== null && pointsAway > 0 && (
        <p className="rail-soft mt-2 text-sm text-rail-soft">
          <span className="rail-strong">{pointsAway} {pointsAway === 1 ? 'point' : 'points'}</span> from {next!.name}.
        </p>
      )}
    </div>
  )
}
