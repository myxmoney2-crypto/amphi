# AMFI — MVP / Beta

SaaS étudiant : enregistrement d'un cours en amphi → transcription (Whisper) →
leçon structurée + quiz + carte mentale (Claude). Implémenté avec Next.js
(App Router) sur Vercel pour le front, Supabase (Auth + Postgres + Storage +
Edge Functions) pour le back, y compris le traitement IA qui tourne en
arrière-plan de façon totalement asynchrone (voir "Pipeline de traitement"
plus bas).

Voir [AMFI-cahier-des-charges.md](./AMFI-cahier-des-charges.md) pour le brief complet.

> `index.html` à la racine est un ancien prototype (reconnaissance vocale
> navigateur + clé API en clair côté client) conservé tel quel — il n'est pas
> utilisé par l'application Next.js et peut être ignoré/supprimé.

## 1. Installer les dépendances

```bash
npm install
```

## 2. Configurer Supabase

1. Dans le [SQL Editor](https://supabase.com/dashboard) du projet, exécuter
   le contenu de [`supabase/schema.sql`](./supabase/schema.sql). Cela crée :
   - les tables `profiles`, `subjects`, `courses`, `lessons`, `quizzes`, `mindmaps`
   - les policies RLS (chaque utilisateur ne voit que ses propres données)
   - le trigger qui crée un `profile` à l'inscription
   - le trigger qui numérote les cours par utilisateur ("Cours n°4")
   - le bucket de storage privé `course-audio` + ses policies
2. Dans **Authentication > Providers > Email**, activer **Confirm email**
   (double opt-in) pour limiter les faux comptes.
3. Dans **Authentication > URL Configuration**, ajouter comme *Redirect URL* :
   - `http://localhost:3000/auth/callback` (dev)
   - `https://<ton-domaine-vercel>/auth/callback` (prod)
4. Déployer l'Edge Function qui fait le vrai traitement (voir
   [`supabase/functions/process-course`](./supabase/functions/process-course)) :

   ```bash
   npx supabase login
   npx supabase link --project-ref <ton-project-ref>
   npx supabase functions deploy process-course
   npx supabase secrets set OPENAI_API_KEY=sk-xxxxxxxx ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
   ```

   `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées
   automatiquement dans les Edge Functions, pas besoin de les configurer.

## 3. Variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplir avec les clés Supabase (Project Settings > API), OpenAI et
Anthropic déjà créées côté compte (voir cahier des charges). Le rôle
"service" Supabase (`SUPABASE_SERVICE_ROLE_KEY`) ne doit **jamais** être
préfixé `NEXT_PUBLIC_` — il n'est utilisé que côté serveur (route API de
traitement) pour lire le fichier audio privé.

## 4. Lancer en local

```bash
npm run dev
```

## Pipeline de traitement (100% asynchrone)

Le traitement (Whisper + 2 appels Claude) peut prendre plusieurs minutes
pour un cours long — il ne tourne **jamais** dans le cycle de vie d'une
requête HTTP que le client attend, donc aucune limite de 60s côté Vercel :

1. `components/record/Recorder.tsx` enregistre l'audio via `MediaRecorder`
   et l'upload directement dans Supabase Storage (bucket privé
   `course-audio/<user_id>/<course_id>.webm`) — pas de limite de taille liée
   aux fonctions serverless.
2. Le client crée la ligne `courses` (status `processing`) puis appelle
   `POST /api/courses/process` avec juste le `courseId`, et **repart
   immédiatement** vers la page du cours (il n'attend pas la fin du
   traitement).
3. Cette route Next.js (`app/api/courses/process/route.ts`) est volontairement
   légère : elle vérifie que le cours appartient bien à l'utilisateur, repasse
   son statut à `processing`, puis relaie l'appel vers l'**Edge Function
   Supabase** `process-course` et répond aussitôt — c'est un simple relais,
   jamais bloqué plus de quelques secondes.
4. L'Edge Function (`supabase/functions/process-course/index.ts`, runtime
   Deno chez Supabase — totalement indépendant de Vercel) répond elle-même
   en moins d'une seconde (202) puis continue le vrai travail **en
   arrière-plan** via `EdgeRuntime.waitUntil(...)` :
   - télécharge l'audio depuis Storage (client "service role")
   - l'envoie à Whisper → transcription brute
   - envoie la transcription à Claude pour la dédupliquer et la structurer en
     blocs (titres/sous-titres/définitions/paragraphes)
   - envoie la leçon structurée à Claude pour générer quiz (5-10 questions)
     + carte mentale
   - enregistre `lessons` / `quizzes` / `mindmaps`, passe `courses.status`
     à `done` (ou `error` avec le message en cas d'échec)
5. Le statut est visible en direct dans le dashboard
   (`components/dashboard/CourseList.tsx`) et sur la page du cours
   (`components/lesson/ProcessingWatcher.tsx`) via un abonnement **Supabase
   Realtime** sur `public.courses` (activé dans `schema.sql`), avec un
   polling de secours toutes les 10s si Realtime n'est pas disponible — donc
   pas besoin de recharger la page pour voir passer "en traitement" → "prêt".

Les Edge Functions Supabase ont elles aussi une durée d'exécution maximale,
mais bien plus généreuse que les 60s de Vercel et indépendante de son plan —
largement suffisante pour un cours d'1-2h ; voir la doc Supabase Edge
Functions pour la valeur exacte selon ton plan. En cas d'échec, un bouton
"Réessayer" est disponible sur la page du cours.

## Modèle freemium

`lib/types.ts` définit `FREE_BLOCK_LIMIT = 3` : un utilisateur non premium
(`profiles.is_premium = false`) ne voit que les 3 premiers blocs de chaque
leçon (`components/lesson/LessonViewer.tsx`), le reste est flouté avec un
CTA. Pas de paiement réel branché pour la beta (Stripe exclu du MVP, voir
cahier des charges) — le bouton affiche un message d'attente.

## Déploiement (Vercel + GitHub)

1. Pousser ce repo sur GitHub.
2. Importer le repo dans Vercel, renseigner les variables d'environnement
   de `.env.local.example` dans les Project Settings.
3. Ajouter l'URL de prod dans les Redirect URLs Supabase (étape 2.3).

## Hors périmètre MVP (V2, voir cahier des charges)

Paiement Stripe réel, découpage audio en live, templates de leçon
multiples, suivi de progression, emails marketing (Brevo), tracking
(PostHog), auto-hébergement de Whisper.
