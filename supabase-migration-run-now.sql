-- ============================================================
-- WebGecko — Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── clients table ────────────────────────────────────────────
alter table clients add column if not exists metadata jsonb default '{}';
alter table clients add column if not exists launch_ready boolean default false;
alter table clients add column if not exists has_booking boolean default false;

-- ── jobs table ───────────────────────────────────────────────
-- SuperSaas schedule fields
alter table jobs add column if not exists supersaas_url text;
alter table jobs add column if not exists supersaas_id bigint;

-- Tawk.to live chat property ID
alter table jobs add column if not exists tawkto_property_id text;

-- Metadata jsonb — stores SuperSaas sub-user credentials, extra intake fields, etc.
alter table jobs add column if not exists metadata jsonb default '{}';

-- ── Confirm all columns exist ─────────────────────────────────
select table_name, column_name, data_type
from information_schema.columns
where (table_name = 'jobs' and column_name in ('supersaas_url', 'supersaas_id', 'tawkto_property_id', 'metadata'))
   or (table_name = 'clients' and column_name in ('metadata', 'launch_ready', 'has_booking'))
order by table_name, column_name;
