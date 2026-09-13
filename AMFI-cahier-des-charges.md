# AMFI — Cahier des charges (MVP / Beta test)

## Concept
SaaS destiné aux étudiants. L'étudiant enregistre son cours en amphi, l'app transcrit l'audio, nettoie le texte (répétitions, bruit), et génère une leçon structurée + un quiz + une carte mentale pour réviser.

**Tagline / accroche landing page :** "Focus sur le prof. Le reste est géré."

## Cible
Étudiants en université/amphi, prioritairement les cours magistraux (CM) où la prise de notes en temps réel est difficile. Contexte initial : promo de 170 élèves, extensible ~400 par bouche-à-oreille, avec ambition d'exporter à d'autres universités en France ensuite.

## Stack technique
- Frontend : HTML/JS (ou React), déployé sur **Vercel**, connecté à un repo **GitHub**
- Base de données + Auth + Storage : **Supabase** (projet créé, clé "Publishable" à utiliser côté frontend, "Secret" réservée à un usage serveur futur)
- Transcription audio → texte : **Whisper API (OpenAI)** — clé créée, crédit ajouté
- Structuration de la leçon + génération quiz/carte mentale : **API Claude (Anthropic)** — clé créée, crédit ajouté
- Paiement : **Stripe** (pas pour la beta ; prévu avec facturation à l'usage/metered billing pour le dépassement de forfait au vrai lancement)
- Emails transactionnels (confirmation de compte, notifications) : **Resend** (gratuit jusqu'à 3000 emails/mois)
- Emails marketing (rappels de révision, relances) : **Brevo**, à activer une fois une vraie base d'utilisateurs (gratuit jusqu'à 300 emails/jour)
- Tracking produit (funnel, comportement, attribution des sources de trafic) : **PostHog** (gratuit jusqu'à 1M d'événements/mois)
- Éléments visuels 3D : scènes Spline (liens ci-dessous)

## Pipeline fonctionnel
1. L'étudiant enregistre son cours en une fois (pas de découpage live pour le MVP), via le micro du navigateur.
2. À la fin de l'enregistrement, le fichier audio complet est envoyé à Whisper → transcription brute.
3. La transcription brute est envoyée à Claude avec un prompt de structuration : dédupliquer les répétitions/bruit, organiser par thème, produire une leçon propre (titres, définitions marquées avec ":", etc.).
4. À partir de la leçon structurée, génération automatique d'un quiz (5-10 questions) et d'une carte mentale.

## Authentification & anti-abus
- Connexion/création de compte **obligatoire** pour lancer un cours (comme "ajouter au panier" sur un site e-commerce).
- Chaque utilisateur a son propre compte (Supabase Auth), important pour la beta avec les amis testeurs.
- Activer la **confirmation d'email** (double opt-in) dans les paramètres Supabase Auth pour limiter les faux comptes — gratuit, déjà inclus dans Supabase.
- Pas de restriction à un email universitaire (jugé inutile vu le modèle freemium retenu, voir ci-dessous).

## Modèle freemium
- Utilisateur non payant : voit toujours seulement les **3 premières lignes** de chaque leçon générée, le reste flouté. Pas de "trial" à durée/quantité limitée (plafond permanent par leçon, pas de contournement possible par multi-comptes).

## Modèle d'abonnement (post-beta)
Deux offres, avec facturation à l'usage au-delà du plafond (Stripe metered billing) pour protéger la marge sur les gros utilisateurs :

| Offre | Prix | Cours inclus/mois | Au-delà |
|---|---|---|---|
| Base | 14,99€/mois | 10 cours | facturation à l'usage |
| Illimité (fair-use) | 27,99€/mois | ~18-20 cours réels (affiché "illimité", plafond raisonnable caché dans les CGU) | contact individuel si abus manifeste |

Repères économiques : coût réel ≈ 0,55€/cours (Whisper + Claude), cotisations sociales micro-entreprise ≈ 21,2-25,6% du CA à intégrer dans tout calcul de marge, frais Stripe ≈ 1,5%+0,25€/transaction. Avec ces prix, marge nette visée ≈ 38-40%, cohérente avec les tarifs du marché (comparable à Otter.ai ~9-17$/mois pour la transcription seule, sans structuration IA/quiz/carte mentale).

Piste d'optimisation de marge à moyen terme (une fois ~150-300 utilisateurs payants, quand la facture Whisper dépasse ~150-200€/mois) : auto-hébergement de Whisper sur GPU loué (ex. RunPod), qui peut diviser le coût de transcription par 10 à 30 par rapport à l'API OpenAI.

## Structure du site
### Landing page (avant connexion)
- Nom : **AMFI**
- Identité visuelle : fond **clair** (crème/bleu pâle), grosse typographie noire bold, formes 3D flottantes en dégradé holographique façon bulle métallique multicolore (inspiration : scènes Spline "Journey" et "Studio")
- Accroche : "Focus sur le prof. Le reste est géré."
- CTA : bouton pilule sombre → "Se connecter / Créer un compte"
- En dessous : bouton "Faire son cours" → redirige vers connexion/inscription si pas connecté

### Dashboard (après connexion)
- Répertoire de tous les cours de l'utilisateur : nom du cours, matière, date, auto-numérotés chronologiquement (ex : "Cours n°4 — 13 octobre")
- Organisation par matière (l'étudiant renseigne ses matières : sociologie, économie, etc.)
- Accès pour réviser (relancer quiz / carte mentale) ou consulter la leçon
- Bouton pour démarrer un nouveau cours (lance l'enregistrement)

### Éditeur de leçon
- Design épuré façon Word/Notion — ne doit pas ressembler à un dictaphone
- Barre d'outils minimale en haut : bouton micro discret, options de mise en forme basiques (texte modifiable, couleurs)
- Un seul template de leçon pour la beta (bien designé : titres, définitions, couleurs). Templates multiples selon différentes méthodes d'apprentissage envisagés pour plus tard, pas pour le MVP.

## Assets visuels (Spline)
- Personnage 3D (style pion/dessin animé sans visage) : `https://prod.spline.design/b5mPdxsQ0yr79da6/scene.splinecode` — à dupliquer en code (pas dans Spline) pour composer une scène de classe (prof + élèves assis, poses variées, règle ajoutée en primitive simple)
- Clavier 3D : `https://prod.spline.design/n8cpw8nXRBLFuXPK/scene.splinecode` — idée d'animation CTA : le clavier "disparaît" au clic pour symboliser "plus besoin d'écrire" (animation à coder directement, pas dans Spline)

## Comptes & accès déjà en place
- OpenAI : compte créé, clé API générée, crédit ajouté (10$)
- Anthropic : compte créé, clé API générée, crédit ajouté (5$)
- Supabase : projet créé, Project URL + Publishable key récupérées
- GitHub & Vercel : comptes existants, à connecter une fois le code généré

## Périmètre du MVP (beta test avec amis)
Inclus :
- Enregistrement → transcription → leçon structurée → quiz + carte mentale
- Comptes séparés par utilisateur, avec confirmation d'email
- Modèle freemium (3 lignes visibles / floutage du reste)
- Landing page + dashboard + éditeur de leçon
- Emails transactionnels de base (Resend)

Exclus pour l'instant (V2) :
- Paiement réel (Stripe) et facturation à l'usage
- Découpage audio live / streaming
- Templates de leçon multiples
- Suivi de progression basé sur l'historique des quiz
- Emails marketing (Brevo), tracking avancé (PostHog) — à activer dès que la beta tourne bien
- Auto-hébergement de Whisper

## Budget estimé phase de test
- Whisper + Claude : quelques dollars pour tout le test (déjà couverts par les 10$ + 5$ de crédit ajoutés)
- Supabase / Vercel / Resend / PostHog : gratuit (free tier largement suffisant à ce volume)
