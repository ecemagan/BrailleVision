create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'member',
  preferences jsonb not null default '{"dashboardDensity":"comfortable","documentView":"documents","themeAccent":"lilac","themeMode":"light","onboardingCompleted":false,"notificationsEnabled":true}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists role text not null default 'member',
  add column if not exists preferences jsonb not null default '{"dashboardDensity":"comfortable","documentView":"documents","themeAccent":"lilac","themeMode":"light","onboardingCompleted":false,"notificationsEnabled":true}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.profiles
set
  email = coalesce(email, ''),
  display_name = coalesce(nullif(display_name, ''), split_part(email, '@', 1), 'Braille Vision User'),
  role = coalesce(role, 'member'),
  preferences = jsonb_build_object(
    'dashboardDensity', coalesce(preferences->>'dashboardDensity', 'comfortable'),
    'documentView', case
      when coalesce(preferences->>'documentView', 'documents') = 'library' then 'documents'
      else coalesce(preferences->>'documentView', 'documents')
    end,
    'themeAccent', case
      when coalesce(preferences->>'themeAccent', 'lilac') = 'sunrise' then 'lilac'
      else coalesce(preferences->>'themeAccent', 'lilac')
    end,
    'themeMode', coalesce(preferences->>'themeMode', 'light'),
    'onboardingCompleted', coalesce((preferences->>'onboardingCompleted')::boolean, false),
    'notificationsEnabled', coalesce((preferences->>'notificationsEnabled')::boolean, true)
  )
where email is null
   or display_name is null
   or role is null
   or preferences is null
   or preferences->>'themeMode' is null
   or preferences->>'notificationsEnabled' is null
   or preferences->>'onboardingCompleted' is null
   or preferences->>'documentView' = 'library'
   or preferences->>'themeAccent' = 'lilac';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('member', 'admin'));
  end if;
end
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  original_text text not null,
  braille_text text not null,
  source_type text not null default 'manual',
  conversion_mode text not null default 'text',
  tags text[] not null default '{}'::text[],
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.documents
  add column if not exists source_type text not null default 'manual',
  add column if not exists conversion_mode text not null default 'text',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.documents
set
  source_type = coalesce(source_type, 'manual'),
  conversion_mode = coalesce(conversion_mode, 'text'),
  tags = coalesce(tags, '{}'::text[]),
  is_favorite = coalesce(is_favorite, false),
  is_archived = coalesce(is_archived, false),
  updated_at = coalesce(updated_at, created_at, timezone('utc', now()))
where source_type is null
   or conversion_mode is null
   or tags is null
   or is_favorite is null
   or is_archived is null
   or updated_at is null;

create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

create index if not exists documents_tags_gin_idx
  on public.documents using gin (tags);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_source_type_check'
  ) then
    alter table public.documents
      add constraint documents_source_type_check
      check (source_type in ('manual', 'pdf', 'image', 'camera', 'word-addin'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_conversion_mode_check'
  ) then
    alter table public.documents
      add constraint documents_conversion_mode_check
      check (conversion_mode in ('text', 'nemeth', 'ocr'));
  end if;
end
$$;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can view their own documents" on public.documents;
create policy "Users can view their own documents"
on public.documents
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own documents" on public.documents;
create policy "Users can insert their own documents"
on public.documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own documents" on public.documents;
create policy "Users can update their own documents"
on public.documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own documents" on public.documents;
create policy "Users can delete their own documents"
on public.documents
for delete
using (auth.uid() = user_id);
