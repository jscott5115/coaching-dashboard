-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates the table that stores all your daily coaching data

create table if not exists daily_logs (
  id bigint generated always as identity primary key,
  date date not null unique,
  weight numeric(5,1),
  hrv integer,
  rhr integer,
  sleep_score integer,
  sleep_duration text,
  xert_burn integer default 0,
  meals jsonb default '[]'::jsonb,
  checklist jsonb default '{"sardines":false,"fermented":false,"fiber":false,"resistant_starch":false}'::jsonb,
  locked boolean default false,
  notes text default '',
  total_calories numeric(7,1) default 0,
  total_protein numeric(6,1) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast date lookups and range queries
create index if not exists idx_daily_logs_date on daily_logs(date);

-- Auto-update the updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on daily_logs
  for each row
  execute function update_updated_at_column();

-- Enable Row Level Security (optional but recommended)
-- Uncomment these if you add auth later:
-- alter table daily_logs enable row level security;
-- create policy "Users can manage own data" on daily_logs
--   for all using (true) with check (true);
