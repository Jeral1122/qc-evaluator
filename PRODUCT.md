# Call QC — product truth

## What it is
An internal quality-control tool for a coaching business. An operator pastes the transcript of a
coaching call, says which kind of call it was, and gets back a report scoring that call out of
100 against a rubric the business itself wrote. The report is written to the coach who ran the
call, and is downloadable as a PDF.

## Who uses it
Two people, in sequence and never at the same time.

**The operator.** Someone inside the coaching business doing QC. They have a transcript in the
clipboard from Fathom or Fireflies. They are doing this repeatedly, several calls in a sitting.
Their whole job on this surface is paste, choose, submit. Speed and certainty matter; nothing
should ask them to think.

**The coach.** Reads the finished report, usually once, often after being sent a link. They are
being assessed by it, which means the report has to be both direct and fair-feeling. They will
skim the top and read the detail only if the top earns it.

## The job the report does
Twelve dimensions, unequal weights. The coach needs, in this order: the one change that would
move the number most, a short brief on how the call went, anything putting the client at risk of
leaving, the grade, then the evidence per dimension. That order is the client's, not ours.

## Non-negotiable product truths
- Every claim is backed by a verbatim quote from the transcript. Unevidenced scores fail the run.
- Every number is computed in code. The model never does arithmetic.
- Automatic ceilings can cap a call. A capped 70 and an earned 70 are different and must read
  differently.
- Two coaching dimensions can be N/A. A coach must never read N/A as failure.
- A failed run says why, in a sentence a person can act on.
- Screen and PDF are the same components and cannot be allowed to diverge.

## Constraints
Next.js on Vercel, Supabase, Claude. No auth. Scoring takes two to three minutes, so the wait is
a real designed state, not an afterthought. Four screens total: intake, waiting, failed, report.

## What success looks like
The operator never wonders whether it worked. The coach reads past the score.
