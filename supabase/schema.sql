-- One table. Run this once in the Supabase SQL editor.
--
-- The report is a single JSONB column rather than a child table of dimensions, because it is
-- an immutable artifact of one scoring run: written once, read whole, never queried into.
-- The moment anyone wants "average score on dimension 3 across all coaches this quarter" that
-- becomes a dimension_scores table and a twenty minute migration. The brief describes a report,
-- not a dashboard, so it is not built.

create table if not exists runs (
  id            uuid primary key default gen_random_uuid(),
  rubric_key    text not null check (rubric_key in ('kickoff', 'coaching')),
  client_name   text,
  coach_name    text,
  transcript    text not null,

  status        text not null default 'queued'
                check (status in ('queued', 'running', 'complete', 'failed')),
  -- Human readable, always. "A failed run says why" is in the brief, so a stack trace here
  -- would be a bug.
  error_reason  text,

  report        jsonb,
  -- Denormalised out of the JSONB so a future list view can sort without unpacking JSON.
  total_score   int,
  band          text,

  created_at    timestamptz not null default now(),
  -- Stamped when the background task picks the row up. Exists only so a reader can tell the
  -- difference between "still working" and "the process died without saying so".
  started_at    timestamptz,
  completed_at  timestamptz
);

-- Every read and write goes through the service role, server side only. Transcripts are a
-- client's private call recordings, so the anon key must never be able to reach this table.
-- RLS on with no policies is the whole lock: it denies everyone except the service role,
-- which bypasses RLS by design.
alter table runs enable row level security;
