import type { Metadata } from 'next'
import { Instrument_Serif, Inter } from 'next/font/google'
import './globals.css'

// Serif for the headings and the score, because this is a document. Sans for the body, because
// long reasoning is easier to read that way on a screen.
const display = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

const body = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Call QC',
  description: 'Score a coaching call transcript against the rubric it was run under.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
