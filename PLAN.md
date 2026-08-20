# Build plan

> Ordered by risk, not by layers. The scoring core is what BeaverMind grades, so it is built and
> proven against the four real transcripts **before** a single component is styled. If the clock
> runs out, what exists is the part that counts.

**Deadline: Tuesday 25 August 2026, 15:00 CEST (18:00 Peshawar). It does not move.**
**Design direction: editorial report.** The PDF is the native form. The screen is a faithful
version of it, not the other way round.

Read alongside `ARCHITECTURE.md` (why) and `CLAUDE.md` (rules). This file is the how and the order.

---

## The three decisions made while planning

### 1. The model never does arithmetic

Claude returns per-dimension bucket scores, which caps it observed firing, and the written
sections. **Every number on the report is computed in TypeScript**: the sum, the denominator, the
percentage, the cap clamping, the band.

An LLM asked to add twelve numbers and apply a conditional ceiling will be right most of the time,
and "most of the time" is not a scoring system. It is also untestable, whereas a pure function
over a fixed input is trivially testable. This is the single most defensible line in the build and
it belongs in the Loom.

### 2. Opus 5 for scoring, switchable by env var

The exercise is graded on fidelity to rubrics full of calibration anchors drawn from real reviewer
corrections. Latency is invisible because scoring is backgrounded, and the volume is a handful of
runs. `SCORING_MODEL` drops it to Sonnet in one line if the function time limit bites.

### 3. The stale-run guard

A `try/catch` only fires while the process is alive. If the background task exceeds the function's
`maxDuration`, Vercel terminates it, the catch never runs, and the row sits at `running` forever.
That silently breaks "a failed run says why".

`maxDuration` is set explicitly on the route, and `GET /api/runs/[id]` treats a `running` row
older than that limit as failed with the reason "scoring timed out". A dead process cannot report
its own death, so the reader infers it from the clock.

---

## File tree

```
app/
  layout.tsx                     fonts, base styles
  page.tsx                       paste form
  runs/[id]/page.tsx             report, or progress, or the failure reason
  runs/[id]/print/page.tsx       same report, every dimension forced open
  api/runs/route.ts              POST  create + hand off
  api/runs/[id]/route.ts         GET   status poll + stale-run guard
components/
  SubmitForm.tsx
  Progress.tsx                   queued / running
  Failure.tsx                    the reason, plainly
  report/Report.tsx              composes everything below; used by screen AND print
  report/Header.tsx              names, call type, date, download button
  report/ScoreBlock.tsx          the number, the band
  report/CapsFired.tsx           which ceilings applied, or nothing
  report/OneThing.tsx
  report/Brief.tsx
  report/RedFlags.tsx
  report/Dimension.tsx           collapsed and expanded states
lib/
  supabase.ts                    service-role client, server only
  rubrics/
    types.ts                     RubricSpec, DimensionSpec, CapSpec, BandSpec
    kickoff.ts                   hand-authored spec
    coaching.ts                  hand-authored spec
    index.ts                     spec + raw markdown by rubric_key
  scoring/
    schema.ts                    Zod, built from the spec
    prompt.ts                    whole rubric + whole transcript
    claude.ts                    one call, forced tool
    verify.ts                    quote substring check
    total.ts                     caps, denominator, band
    run.ts                       the background task
  types.ts                       Run, Report, Dimension result
tests/
  rubrics.test.ts
  verify.test.ts
  total.test.ts
rubrics/                         INPUT, never edited
transcripts/                     INPUT, never edited
styles/print.css
```

**One note on reading the rubric markdown at runtime.** `fs.readFileSync` from `process.cwd()`
plus `outputFileTracingIncludes` in `next.config.ts` so Vercel bundles the files. One config line,
and `rubrics/*.md` stays the single source of truth matching the upstream exercise repo byte for
byte. Copying the markdown into a `.ts` string would create a second copy that can drift.

---

## Phase 0 — Skeleton and the deploy pipe · ~30 min

Prove the empty pipe deploys before any logic exists, so a deployment problem surfaces tonight
instead of at 14:00 on Tuesday.

**Do**
- `create-next-app`, TypeScript, App Router, Tailwind
- Supabase project, run the DDL below
- `.env.local` and a committed `.env.example`
- Public GitHub repo, connect Vercel, deploy

```sql
create table runs (
  id            uuid primary key default gen_random_uuid(),
  rubric_key    text not null check (rubric_key in ('kickoff','coaching')),
  client_name   text,
  coach_name    text,
  transcript    text not null,
  status        text not null default 'queued'
                check (status in ('queued','running','complete','failed')),
  error_reason  text,
  report        jsonb,
  total_score   int,
  band          text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz
);

alter table runs enable row level security;
-- deliberately no policies: every read and write goes through the service role,
-- server side only. Transcripts are a client's private call recordings, so the
-- anon key must never be able to read this table.
```

`started_at` exists solely for the stale-run guard. `total_score` and `band` are denormalised out
of the JSONB so a future list view can sort without unpacking JSON.

**Env**

| Key | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, never `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | |
| `SCORING_MODEL` | defaults to Opus 5 |

**Done when:** the live Vercel URL loads and a scratch route writes and reads one row.

---

## Phase 1 — Rubric spec · ~30 min · ✅ DONE

The rubrics are markdown a human wrote. The app needs two things from them: the full text for the
prompt, and a machine-readable spec to validate and compute against.

```ts
type DimensionSpec = {
  id: string          // "D1"
  name: string        // "Check-In & Connection"
  max: number         // 10
  buckets: number[]   // [10, 7, 4, 0] descending, exactly what the rubric table allows
  optional?: true     // coaching D4 only
}

type CapSpec =
  | { kind: 'total';     id: string; max: number; condition: string }
  | { kind: 'dimension'; id: string; dimension: string; max: number; condition: string }

type RubricSpec = {
  key: 'kickoff' | 'coaching'
  dimensions: DimensionSpec[]
  caps: CapSpec[]
  bands: { name: string; min: number }[]   // descending
  markdownFile: string
}
```

Hand-authored, not parsed. Parsing markdown tables is a fragile hour spent on input that will
never change again.

**Done when** `rubrics.test.ts` passes:
- kick-off maxes sum to 100, coaching to 105
- every `buckets` array is strictly descending, starts at `max`, ends at 0
- every cap's `dimension` refers to a dimension that exists
- bands are descending and cover 0 to 100 with no gap
- exactly one dimension is `optional`, and only on coaching

---

## Phase 2 — Prompt, schema, one call · ~40 min · ✅ DONE

**`schema.ts`** builds the Zod schema from the spec, so the schema can never disagree with the
rubric. Per-dimension score is `z.union` of literals from `allowedScores(dimension)`, which
handles both rubrics: coaching yields its four exact values, kick-off yields every landing point
inside its bands, gaps excluded.

Original plan said "enum of that dimension's buckets", which was only right for coaching.
Kick-off scores in ranges. `allowedScores` flattens the difference.

```ts
{
  one_thing:  { change: string, projected_score: number, why: string },
  brief:      string,
  red_flags:  { flag: string, why: string }[],          // may be empty
  caps_observed: string[],                              // cap ids the model saw fire
  dimensions: {
    id: string,
    score: number | null,                               // enum of THIS dimension's buckets
    reasoning: string,
    evidence: string[],                                 // verbatim quotes
    quick_fix: string,
    not_evidenced: boolean,
    disabled?: boolean,                                 // coaching D4 only
    disabled_reason?: string
  }[]
}
```

No `total`, no `band`, no `percentage`. The model is not asked for them because it is not
permitted to compute them.

**`prompt.ts`** — the whole rubric markdown verbatim, then the whole transcript, then the rules:
quote before you judge, never invent a quote, mark absent behaviour rather than inferring it,
report caps you observe but do not do arithmetic.

**`claude.ts`** — one call, `tool_choice` forcing the schema, `max_tokens` sized for twelve
dimensions of reasoning.

**Done when:** a scratch script scores `transcripts/kickoff-02.txt` (the short one, 15.5k chars)
and prints raw JSON. Nothing is persisted. This is the first moment we learn whether the whole
approach works.

---

## Phase 3 — Validation and the maths · ~40 min · ✅ DONE

**The graded core.** Pure functions. No network, no database, fully unit tested.

**`verify.ts`**
- every quote in every `evidence` array must be a substring of the submitted transcript
- normalise whitespace on both sides before comparing, because transcripts wrap and models
  reflow. Nothing else is normalised: no case folding, no punctuation stripping, no fuzzy match.
  Loosening this check is loosening the one guarantee the exercise is testing.
- a dimension scored above its lowest bucket with an empty `evidence` array throws
- any failure throws with a message naming the dimension and the offending quote

**`total.ts`**, in this order and the order matters:
1. clamp each dimension by any `kind: 'dimension'` cap that fired
2. drop `disabled` dimensions from both numerator and denominator
3. `raw = sum(scores)`, `denominator = sum(max of applicable dimensions)`
4. `percent = round(raw / denominator * 100)`
5. clamp by the lowest `kind: 'total'` cap that fired
6. band by inclusive lower bound
7. return `{ raw, denominator, percent, band, capsFired[] }` so the report can show its working

**Done when** `total.test.ts` and `verify.test.ts` pass:

| Case | Expects |
|---|---|
| clean kick-off, no caps | percent equals raw, band from the table |
| one fabricated quote | throws, names the dimension |
| dimension scored 7/10 with zero evidence | throws |
| coaching, next call not booked | D10 forced to 0 |
| coaching, coach monologue | total clamped to 75 even if raw is higher |
| two total caps fire at once | the lower one wins |
| coaching, D4 disabled | denominator is 90, D4 absent from both sides |
| percent lands on exactly 70 | band is Inconsistent, not At risk |
| every dimension at 0 | percent 0, band Fail, no crash |

---

## Phase 4 — Database and routes · ~40 min · ✅ DONE

**`POST /api/runs`** — validate the transcript is non-empty and the rubric key is known, insert
`queued`, `waitUntil(score(id))`, return `201 { id }`. Explicit `maxDuration`. The insert happens
before Claude is touched, so the URL is valid the instant it is handed out.

**`lib/scoring/run.ts`** — set `running` and stamp `started_at`, call, validate, total, write
`complete` with the report JSONB. Any throw writes `failed` with a reason a human can read. Not
"ZodError: expected number", but "The model returned a score of 12 for D3, which only allows
15, 10, 5 or 0."

**`GET /api/runs/[id]`** — status, plus the stale-run guard: `running` and
`started_at < now() - maxDuration - buffer` reads as failed, reason "scoring timed out".

**Done when**
- submit, close the tab immediately, reopen the URL a minute later, the report is there
- submit with a deliberately broken `ANTHROPIC_API_KEY`, the page says why in English
- a row manually set to `running` with an old `started_at` reads as failed

---

## Phase 5 — The report, editorial · ~60 min

### The look

| | |
|---|---|
| Page | warm paper white, not `#fff`. Single column, max ~720px, generous top margin |
| Display | a serif, for headings and the score. Instrument Serif or Fraunces from Google Fonts |
| Body | Inter, 16–17px, generous line height |
| Numbers | tabular figures so scores align down the page |
| Rules | hairline dividers between blocks, no card borders, no shadows, no rounded boxes |
| Accent | one colour, chosen by band. Deep green Elite, ink blue Strong, amber Inconsistent, burnt orange At risk, deep red Fail |
| Evidence | indented, left hairline rule, set as quoted speech. Not italic, people were talking |

No cards, no pills, no progress bars, no icons. The restraint is the point. It should look like
something a consultancy printed, not something a framework generated.

### The blocks, in reading order

Header, score and band, caps fired, the one thing, the brief, red flags, twelve dimensions,
download PDF. This order is the client's, not mine.

**Three states a dimension can be in, and they must look different:**

| State | Reads as |
|---|---|
| scored | `7/10` with reasoning and evidence |
| not_evidenced | the score, plus a plain line saying the behaviour was not verifiable in the transcript |
| not_applicable | `N/A`, greyed, with the disabled reason, and visibly outside the total |

A coach seeing `0/15` next to "Movement Coaching" should never think they failed at something the
call was never meant to contain.

**Done when:** all four transcripts render and you can read each report as the coach and not be
confused by anything on it.

---

## Phase 6 — Print and PDF · ~20 min

`/runs/[id]/print` renders `Report.tsx` with every dimension forced open. `print.css` sets page
margins, hides all chrome, and forbids a page break inside a dimension block. The download button
opens the print route and calls `window.print()`.

The cost is honest and gets said out loud in the Loom: the operator sees a browser print dialog
rather than an instant file download. Bought in exchange for screen and PDF being physically
incapable of drifting apart, since they are the same components.

**Done when:** saved to PDF from Chrome and Safari, nothing clipped, no dimension split across
pages mid-sentence.

---

## Phase 7 — The trap · ~20 min

Score all four transcripts and read each report against its transcript by hand.

The one that matters is the transcript built to catch a guessing system. Confirm the dimensions it
has no evidence for say so, with no invented quotes and no reading of the mood of the call.

**If a single quote in any report is not in its transcript, phase 3 is broken and everything else
stops until it is fixed.** This is the check the whole exercise is built around.

Keep notes while reading. They become the Loom.

---

## Phase 8 — Ship · ~30 min

- `README.md`: what it does, how to run it, the decisions and why, what was deliberately not built
- Self-review of the full diff, then `tsc --noEmit`, then the security pass, then deploy
- Verify in production, not just green locally
- Record the Loom

**Loom outline**, roughly eight minutes:
1. What it does, demoed live on a real transcript
2. Write the row before the model, so the URL is valid immediately
3. `waitUntil` instead of a queue, and where that stops being right
4. The model never does arithmetic
5. The substring check, and the fact that it is code and not a prompt
6. The coaching rubric summing to 105 while its prose says 100, and the call made
7. The stale-run hole and the read-time guard
8. What was left out and what would have been asked

Send the repo, the live link and the Loom to support@beavermind.ai.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Opus exceeds the function limit | medium | `maxDuration` raised, stale guard catches it, `SCORING_MODEL` drops to Sonnet |
| Model returns a quote that is close but not exact | **high** | whitespace-normalised substring match, nothing looser. If it fails often, tighten the prompt, never the check |
| Model interpolates a score off-bucket | medium | per-dimension enum, fails the run with a readable reason |
| Rubric markdown not bundled on Vercel | medium | `outputFileTracingIncludes`, verified in phase 0 not phase 8 |
| Print CSS breaks a dimension across pages | medium | `break-inside: avoid`, tested in two browsers |
| Time | **high** | risk-ordered phases, cut list below |

---

## If time runs short

Cut in this order, and say what was cut in the Loom.

1. Print styling refinement, ship the plain print route
2. Dimension open and close interaction, ship them open
3. The form's polish, a plain textarea still works
4. The second browser's PDF check

**Never cut:** the quote substring check, the cap logic, the failure reasons, the permanent URL.
Those four are the requirements BeaverMind named out loud.
