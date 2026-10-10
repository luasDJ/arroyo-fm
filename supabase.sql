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

create table if not exists public.radio_podcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  media_path text not null unique,
  media_type text not null check (media_type in ('audio/mpeg', 'video/mp4')),
  created_at timestamptz not null default now()
);

-- Los archivos son públicos para reproducción, pero las subidas solo se autorizan
-- mediante URLs firmadas generadas por la función podcast-media.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('radio-podcasts', 'radio-podcasts', true, 104857600, array['audio/mpeg', 'video/mp4'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Después de ejecutar este SQL, despliega: supabase functions deploy podcast-media

insert into public.radio_config (id, mode, gocast_url, gocast_type, updated_at)
values (1, 'caster', '', 'link', now())
on conflict (id) do nothing;

-- La web puede leer públicamente. Las escrituras pasan por una función RPC que
-- compara el código recibido con el código guardado en un esquema no expuesto por la API.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.admin_settings (
  id integer primary key check (id = 1),
  access_code text not null
);

revoke all on private.admin_settings from public, anon, authenticated;

insert into private.admin_settings (id, access_code)
values (1, '__CONFIGURE_ADMIN_CODE__')
on conflict (id) do nothing;

-- After running this script, configure your secret code in the SQL Editor:
-- update private.admin_settings
-- set access_code = 'YOUR_LONG_RANDOM_CODE'
-- where id = 1;

alter table public.radio_config enable row level security;
alter table public.radio_events enable row level security;
alter table public.radio_announcements enable row level security;
alter table public.radio_podcasts enable row level security;

drop policy if exists "Public read radio_config" on public.radio_config;
create policy "Public read radio_config" on public.radio_config
for select using (true);

drop policy if exists "Public update radio_config" on public.radio_config;
drop policy if exists "Public insert radio_events" on public.radio_events;
drop policy if exists "Public delete radio_events" on public.radio_events;
drop policy if exists "Public insert radio_announcements" on public.radio_announcements;
drop policy if exists "Public delete radio_announcements" on public.radio_announcements;

drop policy if exists "Admin update radio_config" on public.radio_config;
drop policy if exists "Admin insert radio_events" on public.radio_events;
drop policy if exists "Admin delete radio_events" on public.radio_events;
drop policy if exists "Admin insert radio_announcements" on public.radio_announcements;
drop policy if exists "Admin delete radio_announcements" on public.radio_announcements;

revoke all privileges on public.radio_config, public.radio_events, public.radio_announcements from public, anon, authenticated;
revoke all privileges on public.radio_podcasts from public, anon, authenticated;
grant select on public.radio_config, public.radio_events, public.radio_announcements, public.radio_podcasts to anon, authenticated;
grant all privileges on public.radio_config, public.radio_events, public.radio_announcements, public.radio_podcasts to service_role;

create or replace function public.admin_action(
  p_code text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_expected_code text;
  v_config jsonb;
  v_event jsonb;
  v_announcement jsonb;
  v_podcast jsonb;
  v_item jsonb;
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
  v_table text;
  v_id uuid;
  v_mode text;
  v_url text;
  v_type text;
  v_title text;
  v_description text;
  v_date date;
  v_text text;
  v_media_path text;
  v_media_type text;
begin
  if p_code is null or length(p_code) > 256 then
    raise exception 'Invalid admin code';
  end if;

  select access_code into v_expected_code
  from private.admin_settings
  where id = 1;

  if v_expected_code is null or v_expected_code = '__CONFIGURE_ADMIN_CODE__' then
    raise exception 'Admin code is not configured';
  end if;

  if p_code is distinct from v_expected_code then
    raise exception 'Invalid admin code';
  end if;

  if p_action = 'verify' then
    return jsonb_build_object('ok', true);
  elsif p_action = 'save_config' then
    v_config := p_payload->'config';
    v_mode := v_config->>'mode';
    v_url := coalesce(v_config->>'gocast_url', '');
    v_type := v_config->>'gocast_type';

    if jsonb_typeof(v_config) is distinct from 'object'
      or v_mode is null or v_mode not in ('caster', 'gocast')
      or v_type is null or v_type not in ('link', 'iframe')
      or length(v_url) > 2000
      or (v_mode = 'gocast' and v_url !~* '^https?://') then
      raise exception 'Invalid player configuration';
    end if;

    update public.radio_config
    set mode = v_mode,
        gocast_url = v_url,
        gocast_type = v_type,
        updated_at = now()
    where id = 1
    returning to_jsonb(radio_config) into v_row;

    if v_row is null then
      raise exception 'Player configuration does not exist';
    end if;
    return v_row;
  elsif p_action = 'insert_event' then
    v_event := p_payload->'event';
    v_title := btrim(v_event->>'title');
    v_description := coalesce(v_event->>'description', '');

    if jsonb_typeof(v_event) is distinct from 'object'
      or v_title is null or v_title = '' or length(v_title) > 80
      or coalesce(v_event->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or length(v_description) > 200 then
      raise exception 'Invalid event';
    end if;

    v_date := (v_event->>'date')::date;
    insert into public.radio_events (title, date, description)
    values (v_title, v_date, v_description)
    returning to_jsonb(radio_events) into v_row;
    return v_row;
  elsif p_action = 'insert_announcement' then
    v_announcement := p_payload->'announcement';
    v_title := btrim(v_announcement->>'title');
    v_text := btrim(v_announcement->>'text');

    if jsonb_typeof(v_announcement) is distinct from 'object'
      or v_title is null or v_title = '' or length(v_title) > 60
      or v_text is null or v_text = '' or length(v_text) > 240 then
      raise exception 'Invalid announcement';
    end if;

    insert into public.radio_announcements (title, text)
    values (v_title, v_text)
    returning to_jsonb(radio_announcements) into v_row;
    return v_row;
  elsif p_action = 'insert_podcast' then
    v_podcast := p_payload->'podcast';
    v_title := btrim(v_podcast->>'title');
    v_media_path := v_podcast->>'media_path';
    v_media_type := v_podcast->>'media_type';

    if jsonb_typeof(v_podcast) is distinct from 'object'
      or v_title is null or v_title = '' or length(v_title) > 120
      or v_media_type is null or v_media_type not in ('audio/mpeg', 'video/mp4')
      or v_media_path is null or v_media_path !~ '^podcasts/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|mp4)$'
      or (v_media_type = 'audio/mpeg' and v_media_path !~ '\.mp3$')
      or (v_media_type = 'video/mp4' and v_media_path !~ '\.mp4$') then
      raise exception 'Invalid podcast';
    end if;

    insert into public.radio_podcasts (title, media_path, media_type)
    values (v_title, v_media_path, v_media_type)
    returning to_jsonb(radio_podcasts) into v_row;
    return v_row;
  elsif p_action = 'delete_podcast' then
    if coalesce(p_payload->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid item id';
    end if;

    v_id := (p_payload->>'id')::uuid;
    delete from public.radio_podcasts where id = v_id returning to_jsonb(radio_podcasts) into v_row;
    if v_row is null then
      raise exception 'Item does not exist';
    end if;
    return v_row;
  elsif p_action in ('delete_event', 'delete_announcement') then
    if coalesce(p_payload->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid item id';
    end if;

    v_id := (p_payload->>'id')::uuid;
    if p_action = 'delete_event' then
      delete from public.radio_events where id = v_id returning to_jsonb(radio_events) into v_row;
    else
      delete from public.radio_announcements where id = v_id returning to_jsonb(radio_announcements) into v_row;
    end if;

    if v_row is null then
      raise exception 'Item does not exist';
    end if;
    return jsonb_build_object('ok', true);
  elsif p_action = 'migrate_collection' then
    v_table := p_payload->>'table';
    if v_table is null or v_table not in ('radio_events', 'radio_announcements')
      or jsonb_typeof(p_payload->'items') is distinct from 'array'
      or jsonb_array_length(p_payload->'items') > 100 then
      raise exception 'Invalid content migration';
    end if;

    for v_item in select value from jsonb_array_elements(p_payload->'items')
    loop
      v_title := btrim(v_item->>'title');
      if v_table = 'radio_events' then
        v_description := coalesce(v_item->>'description', '');
        if v_title is null or v_title = '' or length(v_title) > 80
          or coalesce(v_item->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
          or length(v_description) > 200 then
          raise exception 'Invalid event in migration';
        end if;
        v_date := (v_item->>'date')::date;
        insert into public.radio_events (title, date, description)
        values (v_title, v_date, v_description)
        returning to_jsonb(radio_events) into v_row;
      else
        v_text := btrim(v_item->>'text');
        if v_title is null or v_title = '' or length(v_title) > 60
          or v_text is null or v_text = '' or length(v_text) > 240 then
          raise exception 'Invalid announcement in migration';
        end if;
        insert into public.radio_announcements (title, text)
        values (v_title, v_text)
        returning to_jsonb(radio_announcements) into v_row;
      end if;
      v_result := v_result || jsonb_build_array(v_row);
    end loop;
    return v_result;
  end if;

  raise exception 'Unknown admin action';
end;
$function$;

revoke all on function public.admin_action(text, text, jsonb) from public;
grant execute on function public.admin_action(text, text, jsonb) to anon, authenticated;

drop policy if exists "Public read radio_events" on public.radio_events;
create policy "Public read radio_events" on public.radio_events
for select using (true);

drop policy if exists "Public read radio_announcements" on public.radio_announcements;
create policy "Public read radio_announcements" on public.radio_announcements
for select using (true);

drop policy if exists "Public read radio_podcasts" on public.radio_podcasts;
create policy "Public read radio_podcasts" on public.radio_podcasts
for select using (true);
