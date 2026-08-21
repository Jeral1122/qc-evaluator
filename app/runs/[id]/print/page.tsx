import { notFound } from 'next/navigation'
import { db } from '@/lib/supabase.ts'
import { Report } from '@/components/report/Report.tsx'
import type { Run } from '@/lib/types.ts'

export const dynamic = 'force-dynamic'

/**
 * The PDF, which is the same report with every dimension open.
 *
 * Not a second renderer. The one thing that differs is `forPrint`, which opens the twelve
 * <details> elements and drops the download button. Everything the coach sees on paper came out
 * of the same components as the screen, so the two cannot disagree.
 *
 * A run that has not completed has no report to print, so there is nothing to show here.
 */
export default async function PrintPage({ params }: PageProps<'/runs/[id]/print'>) {
  const { id } = await params

  const { data: run } = await db().from('runs').select('*').eq('id', id).maybeSingle<Run>()
  if (!run || run.status !== 'complete' || !run.report) notFound()

  return <Report run={run} forPrint />
}
