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

-- Políticas públicas para entorno sencillo / prueba
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
create policy "Public update radio_config" on public.radio_config
for update using (true) with check (true);

drop policy if exists "Public insert radio_events" on public.radio_events;
create policy "Public insert radio_events" on public.radio_events
for insert with check (true);

drop policy if exists "Public delete radio_events" on public.radio_events;
create policy "Public delete radio_events" on public.radio_events
for delete using (true);

drop policy if exists "Public insert radio_announcements" on public.radio_announcements;
create policy "Public insert radio_announcements" on public.radio_announcements
for insert with check (true);

drop policy if exists "Public delete radio_announcements" on public.radio_announcements;
create policy "Public delete radio_announcements" on public.radio_announcements
for delete using (true);

grant select on public.radio_config, public.radio_events, public.radio_announcements to anon, authenticated;
grant update on public.radio_config to anon, authenticated;
grant insert, delete on public.radio_events, public.radio_announcements to anon, authenticated;
