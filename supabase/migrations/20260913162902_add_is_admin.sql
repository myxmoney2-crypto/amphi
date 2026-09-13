-- Ajoute le champ is_admin (accès illimité, comme premium) et verrouille les
-- colonnes de privilège de "profiles" contre une auto-élévation côté client.

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Idempotent : REVOKE/GRANT ne dupliquent rien s'ils sont déjà en place.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
