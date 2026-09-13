-- AMFI — schema Supabase (MVP / beta)
-- À exécuter dans l'éditeur SQL du projet Supabase (Database > SQL Editor).

create extension if not exists "pgcrypto";

-- =========================================================
-- PROFILES
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  is_premium boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user reads own row"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: user updates own row"
  on public.profiles for update
  using (auth.uid() = id);

-- La policy RLS ci-dessus autorise la mise à jour de sa propre ligne, mais
-- ne restreint aucune colonne : sans ça, un utilisateur pourrait s'attribuer
-- is_premium/is_admin lui-même via une requête directe à l'API. On retire
-- le droit UPDATE global et on ne le redonne que sur full_name — is_premium
-- et is_admin ne restent modifiables que par le service_role (l'app) ou
-- directement dans le Table Editor Supabase.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Auto-creates a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- SUBJECTS (matières)
-- =========================================================
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.subjects enable row level security;

create policy "subjects: crud own rows"
  on public.subjects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- COURSES
-- =========================================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  course_number int not null default 0,
  title text,
  status text not null default 'recording'
    check (status in ('recording', 'processing', 'done', 'error')),
  audio_path text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "courses: crud own rows"
  on public.courses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-numbering per user ("Cours n°4")
create or replace function public.set_course_number()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.course_number is null or new.course_number = 0 then
    select coalesce(max(course_number), 0) + 1
      into new.course_number
      from public.courses
      where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_course_number on public.courses;
create trigger trg_set_course_number
  before insert on public.courses
  for each row execute procedure public.set_course_number();

-- =========================================================
-- LESSONS (leçon structurée, en blocs)
-- content = [{ id, type: 'heading'|'subheading'|'definition'|'paragraph', text }]
-- =========================================================
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses (id) on delete cascade,
  content jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

create policy "lessons: crud via owned course"
  on public.lessons for all
  using (exists (
    select 1 from public.courses c
    where c.id = lessons.course_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = lessons.course_id and c.user_id = auth.uid()
  ));

-- =========================================================
-- QUIZZES
-- questions = [{ question, options: string[4], correctIndex, explanation }]
-- =========================================================
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses (id) on delete cascade,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;

create policy "quizzes: crud via owned course"
  on public.quizzes for all
  using (exists (
    select 1 from public.courses c
    where c.id = quizzes.course_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = quizzes.course_id and c.user_id = auth.uid()
  ));

-- =========================================================
-- MINDMAPS
-- data = { title, children: [{ title, children: [...] }] }
-- =========================================================
create table if not exists public.mindmaps (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mindmaps enable row level security;

create policy "mindmaps: crud via owned course"
  on public.mindmaps for all
  using (exists (
    select 1 from public.courses c
    where c.id = mindmaps.course_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = mindmaps.course_id and c.user_id = auth.uid()
  ));

-- =========================================================
-- STORAGE — bucket privé pour l'audio des cours
-- =========================================================
insert into storage.buckets (id, name, public)
values ('course-audio', 'course-audio', false)
on conflict (id) do nothing;

-- Chemin attendu: <user_id>/<course_id>.webm — chaque utilisateur ne peut
-- lire/écrire que dans son propre dossier.
create policy "course-audio: user manages own folder (select)"
  on storage.objects for select
  using (bucket_id = 'course-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "course-audio: user manages own folder (insert)"
  on storage.objects for insert
  with check (bucket_id = 'course-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "course-audio: user manages own folder (delete)"
  on storage.objects for delete
  using (bucket_id = 'course-audio' and auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================================
-- REALTIME — le dashboard écoute les changements de statut
-- (recording/processing/done/error) pendant que le traitement
-- tourne en arrière-plan dans l'Edge Function.
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courses'
  ) then
    alter publication supabase_realtime add table public.courses;
  end if;
end $$;
