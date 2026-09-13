import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase "service role" — usage strictement serveur (jamais importé
 * côté client). Utilisé pour lire le fichier audio privé pendant le traitement
 * et écrire les résultats sans dépendre de la session utilisateur.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
