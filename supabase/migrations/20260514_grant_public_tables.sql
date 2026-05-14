-- ============================================================
-- WebGecko — explicit table grants for all public tables
-- Required from May 30 2026 per Supabase policy change:
-- Supabase no longer grants default privileges on new tables.
-- This migration makes grants explicit and idempotent.
-- ============================================================

-- Enable Row Level Security on all tables
ALTER TABLE IF EXISTS public.jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.availability    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feedback        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pipeline_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.page_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_state   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analytics       ENABLE ROW LEVEL SECURITY;

-- ── service_role — full access to everything (server-side operations) ──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_errors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_versions   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_state   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics       TO service_role;

-- ── authenticated — full access for logged-in users (RLS policies apply) ──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_errors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_versions   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_state   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics       TO authenticated;

-- ── anon — read-only access to public-facing tables only ──
GRANT SELECT ON public.clients TO anon;
GRANT SELECT ON public.jobs    TO anon;

-- Sequence grants (required for INSERT with serial/bigserial PKs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
