-- Le bucket course-audio n'avait pas de file_size_limit explicite, donc il
-- retombait sur la limite globale du PROJET Supabase.
--
-- Testé en conditions réelles (via updateBucket avec la clé service_role) :
-- cette limite globale est actuellement de 50 MiB très exactement — toute
-- tentative de la dépasser, y compris au niveau du bucket, est rejetée par
-- Supabase lui-même ("The object exceeded the maximum allowed size"). Ce
-- plafond de 50 MiB est celui du plan Free de Supabase et NE PEUT PAS être
-- dépassé en SQL/API : il faut l'augmenter à la main dans le Dashboard
-- (Project Settings > Storage > "Global file size limit"), ce qui
-- nécessite généralement un plan payant (Pro ou plus).
--
-- Cette migration fixe donc le bucket à 50 MiB — le maximum applicable
-- aujourd'hui sans changement de plan. Une fois la limite globale relevée
-- dans le Dashboard, remonte cette valeur en conséquence, par exemple :
--   update storage.buckets set file_size_limit = 524288000 where id = 'course-audio'; -- 500 MiB
update storage.buckets
set file_size_limit = 52428800 -- 50 MiB — plafond actuel du plan Supabase
where id = 'course-audio';
