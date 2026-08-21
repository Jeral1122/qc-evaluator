'use client'

/**
 * Opens the print route and asks the browser to print it.
 *
 * The honest cost of the print-CSS decision: the coach sees a print dialog and chooses "Save as
 * PDF" rather than getting an instant file. Bought in exchange for the screen and the PDF being
 * physically the same components, so they cannot drift apart. Puppeteer would give a real
 * download and needs a bundled Chromium; a second renderer would need the report written twice.
 *
 * Marked no-print so it never appears in the file it produces.
 */
export function DownloadButton({ runId }: { runId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const w = window.open(`/runs/${runId}/print`, '_blank')
        // Wait for the new document to lay out before triggering the dialog, or the print
        // preview captures a blank page.
        w?.addEventListener('load', () => w.print())
      }}
      className="no-print inline-flex items-center gap-2 bg-rail-ink px-5 py-2.5 text-sm text-rail
                 transition-opacity hover:opacity-85"
    >
      Download PDF
    </button>
  )
}
