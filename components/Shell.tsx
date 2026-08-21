import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * The split every screen sits in.
 *
 * A dark rail pinned to the viewport on the left, a paper column that scrolls on the right. The
 * rail is fixed rather than sticky because what it holds is a verdict, and a verdict should not
 * scroll away from the evidence being read against it.
 *
 * Below the rail's breakpoint the two stack and the rail becomes a dark block above the reading,
 * which is the same relationship in one column rather than a different design for small screens.
 *
 * In print the split collapses entirely and the rail turns to ink on white. That constraint is
 * why nothing in the rail may depend on the dark ground to make sense.
 */
export function Shell({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="shell lg:grid lg:min-h-dvh lg:grid-cols-[minmax(19rem,24rem)_1fr]">
      <div
        className="rail on-rail flex flex-col gap-8 bg-rail px-7 py-8 text-rail-ink
                   lg:fixed lg:inset-y-0 lg:left-0 lg:w-[min(24rem,25vw)] lg:overflow-y-auto lg:px-9 lg:py-10"
      >
        {rail}
      </div>

      <main className="main paper-scroll px-6 py-10 sm:px-10 lg:col-start-2 lg:px-14 lg:py-14 xl:px-20">
        <div className="mx-auto max-w-[46rem]">{children}</div>
      </main>
    </div>
  )
}

/**
 * The wordmark, and the only navigation in the product.
 *
 * Two links, because there are two places to be: scoring a call, or looking at ones already
 * scored. Anything more would be a menu for a product with four screens.
 */
export function Wordmark({ context }: { context: string }) {
  return (
    <div className="border-b border-rail-rule pb-5">
      <div className="flex items-baseline justify-between gap-4">
        <Link href="/" className="font-display text-xl leading-none tracking-tight hover:opacity-80">
          Call QC
        </Link>
        <span className="label-rail">{context}</span>
      </div>
      <nav className="mt-3 flex gap-5 text-sm">
        <Link href="/" className="rail-soft text-rail-soft transition-colors hover:text-rail-ink">
          Score a call
        </Link>
        <Link href="/runs" className="rail-soft text-rail-soft transition-colors hover:text-rail-ink">
          Past reports
        </Link>
      </nav>
    </div>
  )
}
