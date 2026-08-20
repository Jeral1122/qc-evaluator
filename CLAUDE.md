# QC Evaluator — project instructions

Read `CONTEXT.md` first, then `ARCHITECTURE.md`, then `PLAN.md`.
`EXERCISE.md` is BeaverMind's own brief, unedited. `AGENTS.md` is Next.js's generated guidance.

**This is a job application with a hard deadline: Tuesday 25 August 2026, 15:00 CEST (18:00 Peshawar).**
It does not move. An honest partial build beats a missed deadline.

Documented in Jay's vault at `Projects/Beavermind QC Evaluator/Beavermind QC Evaluator — Overview.md`.
The vault is the source of truth for anything about Jay, his clients, money or deadlines.
If this file and the vault disagree, the vault wins.

---

## What it is, in one line

An operator pastes a coaching call transcript, picks kick-off or coaching, and gets a report
scored out of 100 against the client's own rubric at a permanent URL, downloadable as a PDF.

---

## The files that are inputs, not code

| Path | What |
|---|---|
| `rubrics/kickoff-call-rubric.md` | 12 dimensions, maxes sum to 100, **band ranges** |
| `rubrics/coaching-call-rubric.md` | 12 dimensions, maxes sum to 105, **exact values**, D2 and D4 conditional |
| `transcripts/*.txt` | four real calls, not all good ones |

**Never edit these.** They are the client's own words and the whole exercise is scoring against
them. They came from `github.com/lukecala/hiring-ai-dev-exercise`.

The two rubrics do not score the same way. Kick-off gives ranges ("Elite 9–10") and allows any
integer inside a band, or half steps when the dimension's max is 5 or less. Coaching gives exact
values ("15, 10, 5, 0") and forbids interpolation. Code must respect both.

---

## Seven rules that decide this build

1. **Never invent a quote.** Every evidence quote is substring-checked against the submitted
   transcript in code. A fabricated quote fails the run. This is not a prompt instruction, it is a
   validation pass. One of the four transcripts exists to catch a system that guesses.

2. **The model never does arithmetic.** Claude returns bucket scores, which caps it saw fire, and
   the written sections. Every number on the report is computed in TypeScript: the sum, the
   denominator, the percentage, the clamping, the band.

3. **The total is not a sum.** Dimension caps clamp first, scores sum, divide by the summed
   applicable maximums, then total caps clamp the percentage. Both rubrics open with a cap table.
   The report names which cap fired.

4. **Two coaching dimensions can be N/A, not one.** D4 switches off when no movement coaching
   happened. D2 scores N/A on a non-milestone call with no video submitted, and that rule is
   buried at the end of D2 rather than in the preamble. Both leave the denominator entirely.

5. **Score inside the rubric's own bands.** No value that falls in a gap between two bands, and no
   band boundary invented that the rubric does not state.

6. **The rubric text goes into the prompt whole.** The calibration anchors are real reviewer
   corrections. Summarising them is how scoring drifts off the human standard.

7. **No scope nobody asked for.** Five routes. No auth, no run history, no coach comparison, no
   rubric editing, no retries, no streaming, no feedback panel, no voice agents. Knowing what to
   leave out is part of what is being scored.

---

## Stack

Next.js App Router on Vercel. Supabase Postgres, one `runs` table. Claude API with a forced tool
schema, validated with Zod. `waitUntil` for background scoring. Print CSS for the PDF.
Supabase and Vercel are mandated by the brief.

Tests run on Node's built-in test runner. Node 25 executes TypeScript directly, so there is no
test framework and no transpile step to install.

---

## How Jay wants to work

**Teaching mode is on for this project.** Jay has to explain this system on camera in a Loom.
So every concept, every decision and every piece of code gets explained in simple language as it
is written, not summarised afterwards. Not dumbed down and not jargon: the version he could
repeat to someone else and be right. If a term appears for the first time (Zod, JSONB, waitUntil,
substring, denominator), define it in one line the moment it appears. He knows things already,
so explain to inform, not to impress and not to condescend.

Plain English before code: what problem, which file, why that file. A short plain-English comment
above every function or important block. After the code, three to five lines on what changed and
what to test. On "why", analogy first, then the technical explanation. Options with a
recommendation, not a survey. Stop him if he is about to do something risky or wrong.

Nothing ships without a review of the diff, a security pass, tests on the scoring and validation
logic, then deploy and verify in production. He pulls the trigger on every commit and deploy.

---

## What has to go back

A public GitHub repo, a live Vercel link, and a Loom with webcam on covering what was built, why,
the trade-offs, what fought back, and what he would have asked the client. **No tool writes the
Loom.** Send to support@beavermind.ai.
