-- Le traitement d'un cours long (plusieurs segments) dépassait la limite de
-- 150s de temps d'exécution "wall clock" des Edge Functions Supabase (plan
-- gratuit) quand tous les segments étaient transcrits à la suite dans un
-- seul appel : confirmé via la doc officielle Supabase, et par le
-- comportement observé sur les cours de plus d'1h15 (5 segments).
--
-- La transcription est maintenant découpée en une chaîne d'appels séparés à
-- l'Edge Function process-course, un par segment (chacun largement sous la
-- limite), qui s'auto-déclenchent l'un l'autre. Cette table sert de mémoire
-- partagée entre ces appels : chaque étape y dépose la transcription de SON
-- segment, la dernière étape (finalize) les relit tous pour construire la
-- transcription complète avant l'appel à Claude.
create table if not exists public.course_segment_transcripts (
  course_id uuid not null references public.courses (id) on delete cascade,
  segment_index int not null,
  transcript text not null,
  created_at timestamptz not null default now(),
  primary key (course_id, segment_index)
);

-- Aucune policy : seule l'Edge Function (clé service role, qui contourne
-- RLS) a besoin d'y accéder, jamais directement le client.
alter table public.course_segment_transcripts enable row level security;
