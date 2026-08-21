import { RUBRICS } from '@/lib/rubrics/index.ts'
import { Shell, Wordmark } from '@/components/Shell.tsx'
import { SubmitForm, type RubricSummary } from '@/components/SubmitForm.tsx'

/**
 * Read out of the rubric specs rather than written here, so the form can never describe a
 * rubric the system does not actually have.
 */
const rubrics: RubricSummary[] = Object.values(RUBRICS).map((r) => ({
  key: r.key,
  title: r.title,
  dimensions: r.dimensions.length,
  points: r.dimensions.reduce((sum, d) => sum + d.max, 0),
  first: r.dimensions[0].name,
  last: r.dimensions.at(-1)!.name,
}))

export default function Home() {
  const rail = (
    <>
      <Wordmark context="Intake" />

      <h1 className="font-display text-[2.4rem] leading-[1.1] tracking-tight">
        Score a call against the rubric it was run under.
      </h1>

      <p className="rail-soft max-w-[38ch] text-[0.925rem] leading-[1.7] text-rail-soft">
        Every dimension is evidenced with quotes checked against the transcript itself. A score
        with nothing behind it fails the run rather than reaching the coach.
      </p>

      <dl className="mt-auto space-y-5 border-t border-rail-rule pt-6">
        <div>
          <dt className="label-rail">How long</dt>
          <dd className="rail-soft mt-1.5 text-sm leading-relaxed text-rail-soft">
            Two to three minutes. It runs on the server, so you can close the tab.
          </dd>
        </div>
        <div>
          <dt className="label-rail">Where it goes</dt>
          <dd className="rail-soft mt-1.5 text-sm leading-relaxed text-rail-soft">
            Every run gets a permanent link and a report the coach can download.
          </dd>
        </div>
      </dl>
    </>
  )

  return (
    <Shell rail={rail}>
      <SubmitForm rubrics={rubrics} />
    </Shell>
  )
}
