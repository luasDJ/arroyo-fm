-- Tablas necesarias para el panel de administración y la web pública
create extension if not exists pgcrypto;

create table if not exists public.radio_config (
  id integer primary key default 1,
  mode text not null default 'caster' check (mode in ('caster', 'gocast')),
  gocast_url text default '',
  gocast_type text not null default 'link' check (gocast_type in ('link', 'iframe')),
  updated_at timestamptz default now()
);

create table if not exists public.radio_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  description text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.radio_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  text text not null,
  created_at timestamptz not null default now()
);

insert into public.radio_config (id, mode, gocast_url, gocast_type, updated_at)
values (1, 'caster', '', 'link', now())
on conflict (id) do nothing;

-- Lectura pública; las escrituras requieren una cuenta autenticada con app_metadata.role = 'admin'.
alter table public.radio_config enable row level security;
alter table public.radio_events enable row level security;
alter table public.radio_announcements enable row level security;

drop policy if exists "Public read radio_config" on public.radio_config;
create policy "Public read radio_config" on public.radio_config
for select using (true);

drop policy if exists "Public read radio_events" on public.radio_events;
create policy "Public read radio_events" on public.radio_events
for select using (true);

drop policy if exists "Public read radio_announcements" on public.radio_announcements;
create policy "Public read radio_announcements" on public.radio_announcements
for select using (true);

drop policy if exists "Public update radio_config" on public.radio_config;
drop policy if exists "Public insert radio_events" on public.radio_events;
drop policy if exists "Public delete radio_events" on public.radio_events;
drop policy if exists "Public insert radio_announcements" on public.radio_announcements;
drop policy if exists "Public delete radio_announcements" on public.radio_announcements;

drop policy if exists "Admin update radio_config" on public.radio_config;
create policy "Admin update radio_config" on public.radio_config
for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admin insert radio_events" on public.radio_events;
create policy "Admin insert radio_events" on public.radio_events
for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admin delete radio_events" on public.radio_events;
create policy "Admin delete radio_events" on public.radio_events
for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admin insert radio_announcements" on public.radio_announcements;
create policy "Admin insert radio_announcements" on public.radio_announcements
for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admin delete radio_announcements" on public.radio_announcements;
create policy "Admin delete radio_announcements" on public.radio_announcements
for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all privileges on public.radio_config, public.radio_events, public.radio_announcements from public, anon, authenticated;
grant select on public.radio_config, public.radio_events, public.radio_announcements to anon, authenticated;
grant update on public.radio_config to authenticated;
grant insert, delete on public.radio_events, public.radio_announcements to authenticated;
