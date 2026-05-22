-- ============================================================
-- WebGecko — analytics summary RPC
-- Replaces 7 separate COUNT queries per analytics report with a
-- single function call, reducing round-trips from 7 to 1.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  p_job_id text,
  p_today  text,   -- ISO date string e.g. '2026-05-23'
  p_month  text    -- ISO month string e.g. '2026-05'
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'month_views',           COUNT(*) FILTER (WHERE event = 'page_view'     AND month = p_month),
    'month_booking_clicks',  COUNT(*) FILTER (WHERE event = 'booking_click' AND month = p_month),
    'month_contact_clicks',  COUNT(*) FILTER (WHERE event = 'contact_click' AND month = p_month),
    'today_views',           COUNT(*) FILTER (WHERE event = 'page_view'     AND date  = p_today),
    'today_booking_clicks',  COUNT(*) FILTER (WHERE event = 'booking_click' AND date  = p_today),
    'total_views',           COUNT(*) FILTER (WHERE event = 'page_view'),
    'total_booking_clicks',  COUNT(*) FILTER (WHERE event = 'booking_click')
  )
  FROM public.analytics
  WHERE job_id = p_job_id;
$$;

-- Grant execute to server-side roles
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(text, text, text) TO authenticated;
