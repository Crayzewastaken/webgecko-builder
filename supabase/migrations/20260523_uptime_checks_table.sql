-- ============================================================
-- WebGecko — uptime_checks table
-- Stores the result of each periodic site health check.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.uptime_checks (
  id          bigserial PRIMARY KEY,
  job_id      text        NOT NULL,
  slug        text,
  url         text        NOT NULL,
  status      text        NOT NULL CHECK (status IN ('up', 'down', 'slow')),
  status_code int,
  latency_ms  int,
  error       text,
  checked_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for the most common query: latest status per job
CREATE INDEX IF NOT EXISTS uptime_checks_job_id_idx  ON public.uptime_checks (job_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS uptime_checks_checked_idx ON public.uptime_checks (checked_at DESC);
CREATE INDEX IF NOT EXISTS uptime_checks_status_idx  ON public.uptime_checks (status, checked_at DESC);

-- Auto-expire rows older than 30 days (keep history lean)
-- Supabase scheduled job or pg_cron:
-- DELETE FROM public.uptime_checks WHERE checked_at < now() - interval '30 days';

ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uptime_checks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uptime_checks TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.uptime_checks_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.uptime_checks_id_seq TO authenticated;
