-- WebGecko Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor

-- If clients table already exists, run these to add missing columns:
-- alter table clients add column if not exists password text;
-- alter table clients add column if not exists metadata jsonb default '{}';
-- alter table clients add column if not exists launch_ready boolean default false;

-- ============================================================
-- JOBS — website build jobs (was job:{jobId} in Redis)
-- ============================================================
create table if not exists jobs (
  id text primary key,
  status text not null default 'pending',
  html text,
  preview_url text,
  vercel_project_name text,
  domain_slug text,
  client_slug text,
  ga4_id text,
  logo_url text,
  hero_url text,
  photo_urls jsonb default '[]',
  products_with_photos jsonb default '[]',
  has_booking boolean default false,
  tawkto_property_id text,
  user_input jsonb,
  fixed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CLIENTS — client portal records (was client:{slug} in Redis)
-- ============================================================
create table if not exists clients (
  slug text primary key,
  job_id text references jobs(id),
  business_name text,
  email text,
  phone text,
  password text,
  plan text default 'starter',
  preview_url text,
  domain text,
  industry text,
  square_customer_id text,
  square_subscription_id text,
  metadata jsonb default '{}',
  launch_ready boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- BOOKINGS — appointment bookings (was booking:{id} in Redis)
-- ============================================================
create table if not exists bookings (
  id text primary key default gen_random_uuid()::text,
  job_id text references jobs(id),
  client_slug text references clients(slug),
  customer_name text,
  customer_email text,
  customer_phone text,
  service text,
  slot_start timestamptz,
  slot_end timestamptz,
  status text default 'confirmed',
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- AVAILABILITY — booking config per business (was availability:{jobId} in Redis)
-- ============================================================
create table if not exists availability (
  job_id text primary key references jobs(id),
  business_name text,
  client_email text,
  timezone text default 'Australia/Brisbane',
  days integer[] default '{1,2,3,4,5}',
  start_hour integer default 9,
  end_hour integer default 17,
  slot_duration_minutes integer default 60,
  buffer_minutes integer default 15,
  max_days_ahead integer default 30,
  services jsonb default '[]',
  updated_at timestamptz default now()
);

-- ============================================================
-- PAYMENTS — payment records (was payment:{id} in Redis)
-- ============================================================
create table if not exists payments (
  id text primary key,
  job_id text references jobs(id),
  client_slug text,
  amount_cents integer,
  currency text default 'AUD',
  status text,
  square_payment_id text,
  square_order_id text,
  created_at timestamptz default now()
);

-- ============================================================
-- FEEDBACK — client feedback (was feedback:{jobId} in Redis)
-- ============================================================
create table if not exists feedback (
  id text primary key default gen_random_uuid()::text,
  job_id text references jobs(id),
  client_slug text,
  rating integer,
  message text,
  created_at timestamptz default now()
);

-- ============================================================
-- ANALYTICS — event counters per job (was Redis incr keys)
-- ============================================================
create table if not exists analytics (
  id bigint generated always as identity primary key,
  job_id text references jobs(id),
  event text not null,
  page text,
  date text not null,       -- YYYY-MM-DD
  month text not null,      -- YYYY-MM
  created_at timestamptz default now()
);

create index if not exists analytics_job_event_date_idx on analytics(job_id, event, date);
create index if not exists analytics_job_event_month_idx on analytics(job_id, event, month);

-- PAYMENTS — payment state per job
create table if not exists payment_state (
  job_id text primary key references jobs(id),
  deposit_paid boolean default false,
  final_unlocked boolean default false,
  final_paid boolean default false,
  monthly_active boolean default false,
  preview_unlocked boolean default false,
  preview_unlocked_at timestamptz,
  final_unlocked_at timestamptz,
  square_subscription_id text,
  payments jsonb default '{}',
  updated_at timestamptz default now()
);

-- ============================================================
-- Indexes for common lookups
-- ============================================================
create index if not exists jobs_client_slug_idx on jobs(client_slug);
create index if not exists jobs_status_idx on jobs(status);
create index if not exists bookings_job_id_idx on bookings(job_id);
create index if not exists bookings_slot_start_idx on bookings(slot_start);
create index if not exists clients_email_idx on clients(email);

-- ============================================================
-- Auto-update updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger jobs_updated_at before update on jobs
  for each row execute function update_updated_at();

c