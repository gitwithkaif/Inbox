-- ==========================================
-- INBOX DATABASE SCHEMA & CONFIGURATION
-- ==========================================

-- 1. Create Pouches Table
create table if not exists public.pouches (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  message text,
  password_hash text,
  created_at timestamptz not null default now()
);

-- Index for fast slug lookups
create index if not exists idx_pouches_slug on public.pouches (slug);

-- 2. Create Files Table
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  pouch_id uuid not null references public.pouches(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  storage_path text not null,
  sender_name text not null,
  sender_message text,
  uploaded_at timestamptz not null default now()
);

-- Index for fast pouch_id lookups and stats
create index if not exists idx_files_pouch_id on public.files (pouch_id);

-- 3. Row Level Security (RLS)
alter table public.pouches enable row level security;
alter table public.files enable row level security;

-- Pouches Policies:
-- Admin (authenticated) has full access
drop policy if exists "Admin full access to pouches" on public.pouches;
create policy "Admin full access to pouches"
  on public.pouches
  for all
  to authenticated
  using (true)
  with check (true);

-- Public (anon) can read pouch details (safe select)
drop policy if exists "Public can read pouches" on public.pouches;
create policy "Public can read pouches"
  on public.pouches
  for select
  to anon
  using (true);

-- Files Policies:
-- Admin (authenticated) can view and delete files
drop policy if exists "Admin full access to files" on public.files;
create policy "Admin full access to files"
  on public.files
  for all
  to authenticated
  using (true)
  with check (true);

-- Public (anon) can insert uploaded file metadata
drop policy if exists "Public can insert files for valid pouch" on public.files;
create policy "Public can insert files for valid pouch"
  on public.files
  for insert
  to anon
  with check (
    exists (
      select 1 from public.pouches
      where public.pouches.id = files.pouch_id
    )
  );

-- 4. Storage Bucket Setup: "pouch-files"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pouch-files', 'pouch-files', false, null, null)
on conflict (id) do update set public = false;

-- Storage Policies:
-- Authenticated users (admin) can read and manage all objects in "pouch-files"
drop policy if exists "Admin full access to pouch files storage" on storage.objects;
create policy "Admin full access to pouch files storage"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'pouch-files')
  with check (bucket_id = 'pouch-files');

-- Public users can upload files into the "pouch-files" bucket
drop policy if exists "Public can upload to pouch files storage" on storage.objects;
create policy "Public can upload to pouch files storage"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'pouch-files');

-- Public users can also read if needed (or through signed URLs)
drop policy if exists "Public or signed url access to pouch files storage" on storage.objects;
create policy "Public or signed url access to pouch files storage"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'pouch-files');

-- 5. Helper Function for public safe pouch info
create or replace function public.get_pouch_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  message text,
  has_password boolean,
  created_at timestamptz
)
language sql
security definer
as $$
  select
    id,
    slug,
    name,
    message,
    (password_hash is not null and password_hash <> '') as has_password,
    created_at
  from public.pouches
  where slug = p_slug
  limit 1;
$$;
