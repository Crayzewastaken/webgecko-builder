-- ============================================================
-- WebGecko — Run this in Supabase Dashboard → SQL Editor
-- Fixes the INTAKE crash: "Could not find the 'metadata' column"
-- ============================================================

-- 1. Add metadata jsonb column (stores all intake fields)
alter table clients add column if not exists metadata jsonb default '{}';

-- 2. Add launch_ready column (set to true on final payment)
alter table clients add column if not exists launch_ready boolean default false;

-- 3. Add has_booking column (true when booking system is enabled/unlocked)
alter table clients add column if not exists has_booking boolean default false;

-- 4. Confirm the columns exist
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'clients'
  and column_name in ('metadata', 'launch_ready', 'password', 'has_booking');
