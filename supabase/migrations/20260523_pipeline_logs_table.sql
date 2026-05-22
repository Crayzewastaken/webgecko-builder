-- ============================================================
-- WebGecko — dedicated pipeline_logs table
-- Replaces the read-modify-write pattern of appending log entries
-- into the jobs.metadata JSON blob, which caused bloat and slow
-- writes as log arrays grew unbounded.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipeline_logs (
  id          bigserial PRIMARY KEY,
  job_id      text        NOT NULL,
  level       text        NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  step        text        NOT NULL,
  msg         text        NOT NULL,
  business_name text,
  ts          timestamptz NOT NULL DEFAULT now()
);

-- Index for the most common query: fetch logs for a specific job
CREATE INDEX IF NOT EXISTS pipeline_logs_job_id_idx ON public.pipeline_logs (job_id, ts DESC);

-- Index for the admin log viewer: all recent logs across all jobs
CREATE INDEX IF NOT EXISTS pipeline_logs_ts_idx ON public.pipeline_logs (ts DESC);

-- Auto-expire logs older than 90 days to prevent table bloat
-- (Supabase cron or pg_cron can enforce this; the index also helps range deletes)

-- RLS
ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY;

-- Grants (matches pattern from 20260514_grant_public_tables.sql)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pipeline_logs_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pipeline_logs_id_seq TO authenticated;
