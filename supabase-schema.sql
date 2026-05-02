-- Recreate the tables used by the app in the new Supabase project.
-- Create the Storage bucket named `media` separately in Supabase Storage and make it public.

-- Simplified `place` table: store only id, parsed Google Maps JSON, and info
create table if not exists public.place (
  id text primary key,
  google_maps_json jsonb,
  info text
);

create index if not exists place_google_maps_json_gin on public.place using gin (google_maps_json);

create table if not exists public."type" (
  id text primary key,
  name text not null
);

create table if not exists public.plan (
  pid text not null references public.place (id) on update cascade on delete cascade,
  time timestamptz not null,
  tid text not null references public."type" (id) on update cascade on delete restrict,
  stay integer,
  info text,
  utc integer,
  primary key (pid, time)
);

create index if not exists plan_time_idx on public.plan (time);
create index if not exists plan_tid_idx on public.plan (tid);

create table if not exists public.tran (
  id text primary key,
  time timestamptz not null,
  name text not null,
  stay integer,
  info text,
  utc integer
);

create index if not exists tran_time_idx on public.tran (time);