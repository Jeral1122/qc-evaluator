import { SubmitForm } from '@/components/SubmitForm.tsx'

export default function Home() {
  return (
    <main className="mx-auto max-w-[42rem] px-6 pb-24 pt-16 sm:px-8">
      <p className="eyebrow">Call QC</p>
      <h1 className="mt-3 max-w-[20ch] font-display text-4xl leading-tight">
        Score a call against the rubric it was run under.
      </h1>
      <p className="mt-4 max-w-[54ch] text-[0.95rem] leading-relaxed text-ink-soft">
        Paste the transcript and pick the call type. Scoring takes two to three minutes and keeps
        running after you close the tab. Every report lives at its own permanent link.
      </p>
      <SubmitForm />
    </main>
  )
}
