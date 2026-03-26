# CLAUDE.md — HPR (Hermès Press Room)

## 🎯 IDENTITÉ DU PROJET

Tu es le CTO et lead developer d'une plateforme SaaS de Relations Presse appelée **HPR — Hermès Press Room**. Tu construis un produit RÉEL, professionnel, prêt à être utilisé en production — pas une démo, pas un prototype. Chaque décision technique doit servir cet objectif.

Le product owner (moi) est entrepreneur avec un bon niveau technique. J'utilise Next.js, Supabase, et je déploie sur Vercel. Explique tes choix en langage clair. Arrête-toi aux décisions importantes pour me consulter.

### Branding
- **Nom complet** : Hermès Press Room
- **Nom court** : HPR
- **Domaine** : hermespressroom.com
- **Logo** : À créer — design élégant et premium. Inspiration : le caducée d'Hermès (messager des dieux) stylisé, minimaliste, monochrome avec accent doré. Le logo doit fonctionner en favicon (16x16), en sidebar (32x32), en page de login (200px+), et en version texte ("HPR"). Génère un logo SVG programmatique, net et vectoriel.
- **Identité visuelle** : luxe discret, précision, fiabilité. Hermès est le messager — la plateforme porte bien son nom. Palette : noir profond, blanc cassé, or/bronze (#B8860B) comme accent, bleu nuit (#1E3A5F) comme secondaire.
- **Signature** : "L'intelligence au service de vos relations presse"

---

## 🏗️ STACK TECHNIQUE

### Core
- **Frontend** : Next.js 14+ (App Router, Server Components, Server Actions)
- **Backend/DB** : Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **Déploiement** : Vercel (frontend) + Supabase (backend)
- **Emails transactionnels** : Resend (tracking ouvertures/clics intégré)
- **IA** : Anthropic Claude API (rédaction, analyse, recommandations)
- **Styling** : Tailwind CSS + shadcn/ui comme base de composants
- **State management** : Zustand pour le state client complexe
- **Forms** : React Hook Form + Zod (validation)
- **Background jobs** : Supabase Edge Functions + pg_cron pour les tâches planifiées
- **Monitoring retombées** : Google News RSS + API recherche web + scraping léger

### Services externes
- **Resend** : Envoi d'emails avec domaines customs, tracking ouvertures/clics/bounces
- **Anthropic API** : Claude pour la rédaction IA, l'analyse, le scoring, les recommandations
- **Google News RSS** : Monitoring gratuit des retombées presse
- **Supabase Storage** : Stockage des pièces jointes, exports PDF, clippings

### Prérequis à configurer avant de commencer
1. **Resend** : Créer un compte sur resend.com → Ajouter le domaine `hermespressroom.com` → Configurer les DNS (SPF, DKIM, DMARC) → Récupérer l'API key
2. **Supabase** : Créer un nouveau projet → Récupérer l'URL et les clés (anon + service_role)
3. **Vercel** : Connecter le repo GitHub → Configurer le domaine `app.hermespressroom.com` (ou `hermespressroom.com`)
4. **Anthropic** : Récupérer l'API key Claude
5. **Variables d'environnement** à configurer :
   ```
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   
   # Resend
   RESEND_API_KEY=
   RESEND_WEBHOOK_SECRET=
   RESEND_FROM_DOMAIN=hermespressroom.com
   
   # Anthropic
   ANTHROPIC_API_KEY=
   
   # App
   NEXT_PUBLIC_APP_URL=https://hermespressroom.com
   NEXT_PUBLIC_APP_NAME="Hermès Press Room"
   ```

---

## 📐 ARCHITECTURE DE LA BASE DE DONNÉES

### Schéma principal (Supabase/PostgreSQL)

```
-- ORGANISATIONS & UTILISATEURS
organizations (
  id uuid PK,
  name text,
  logo_url text,
  settings jsonb, -- config globale agence
  created_at timestamptz
)

users (
  id uuid PK (= auth.users.id),
  organization_id uuid FK → organizations,
  role enum('admin', 'manager', 'member', 'client_viewer'),
  full_name text,
  email text,
  avatar_url text,
  preferences jsonb,
  created_at timestamptz
)

-- CLIENTS
clients (
  id uuid PK,
  organization_id uuid FK → organizations,
  name text,
  industry text,
  logo_url text,
  description text,
  website text,
  sender_name text, -- nom d'expéditeur pour les emails RP (ex: "Marie Dupont")
  sender_email text, -- email expéditeur dédié (ex: marie@hermespressroom.com)
  email_signature_html text,
  settings jsonb, -- config spécifique client
  created_at timestamptz
)

-- JOURNALISTES & CONTACTS
journalists (
  id uuid PK,
  organization_id uuid FK → organizations,
  first_name text,
  last_name text,
  email text UNIQUE,
  phone text,
  media_outlet text, -- nom du média
  media_type enum('presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'influenceur'),
  beat text[], -- thématiques couvertes (tech, santé, culture, etc.)
  location text,
  linkedin_url text,
  twitter_handle text,
  notes text,
  tags text[],
  -- Scoring automatique
  response_rate numeric, -- % de réponses sur total d'envois
  publication_rate numeric, -- % de publications suite à un envoi
  avg_response_time_hours numeric,
  quality_score numeric, -- score global 0-100 calculé automatiquement
  last_contacted_at timestamptz,
  last_responded_at timestamptz,
  -- Enrichissement
  enrichment_data jsonb, -- données d'enrichissement automatique
  enrichment_last_run timestamptz,
  is_verified boolean DEFAULT false,
  is_opted_out boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
)

journalist_interactions (
  id uuid PK,
  journalist_id uuid FK → journalists,
  campaign_id uuid FK → campaigns,
  type enum('email_sent', 'email_opened', 'email_clicked', 'replied', 'bounced', 'meeting', 'call', 'published', 'opted_out'),
  metadata jsonb, -- détails de l'interaction
  created_at timestamptz
)

-- CAMPAGNES
campaigns (
  id uuid PK,
  organization_id uuid FK → organizations,
  client_id uuid FK → clients,
  name text,
  description text,
  status enum('draft', 'preparing', 'review', 'approved', 'sending', 'active', 'paused', 'completed', 'archived'),
  tags text[],
  keywords text[],
  target_date date, -- date cible de la campagne
  embargo_until timestamptz, -- embargo éventuel
  -- Métriques agrégées (mises à jour par trigger)
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_replied integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  total_publications integer DEFAULT 0,
  estimated_reach bigint DEFAULT 0,
  -- IA
  ai_performance_analysis jsonb,
  ai_recommendations jsonb,
  created_at timestamptz,
  updated_at timestamptz
)

-- COMMUNIQUÉS DE PRESSE
press_releases (
  id uuid PK,
  campaign_id uuid FK → campaigns,
  version integer DEFAULT 1,
  title text,
  subtitle text,
  body_html text, -- contenu riche éditable
  body_plain text, -- version texte brut
  email_subject text,
  email_preview_text text,
  -- IA
  ai_quality_score numeric, -- score de qualité 0-100
  ai_quality_analysis jsonb, -- détail : lisibilité, accroche, longueur, ton
  ai_suggestions jsonb, -- suggestions d'amélioration
  -- Versioning
  is_current boolean DEFAULT true,
  created_by uuid FK → users,
  approved_by uuid FK → users,
  approved_at timestamptz,
  created_at timestamptz
)

press_release_attachments (
  id uuid PK,
  press_release_id uuid FK → press_releases,
  file_name text,
  file_url text,
  file_size bigint,
  mime_type text,
  created_at timestamptz
)

-- ENVOIS & TRACKING
email_sends (
  id uuid PK,
  campaign_id uuid FK → campaigns,
  press_release_id uuid FK → press_releases,
  journalist_id uuid FK → journalists,
  resend_email_id text, -- ID Resend pour le tracking
  status enum('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  -- Personnalisation
  personalized_subject text,
  personalized_intro text, -- accroche personnalisée par l'IA
  ab_variant text, -- 'A' ou 'B' pour A/B testing
  created_at timestamptz
)

-- RÉPONSES & RELANCES
email_threads (
  id uuid PK,
  campaign_id uuid FK → campaigns,
  journalist_id uuid FK → journalists,
  email_send_id uuid FK → email_sends,
  status enum('new', 'needs_response', 'responded', 'follow_up_scheduled', 'closed', 'positive', 'negative'),
  sentiment enum('positive', 'neutral', 'negative', 'interested', 'not_interested'),
  -- IA
  ai_suggested_response text,
  ai_response_strategy text,
  priority_score numeric, -- priorité de traitement 0-100
  created_at timestamptz,
  updated_at timestamptz
)

email_messages (
  id uuid PK,
  thread_id uuid FK → email_threads,
  direction enum('inbound', 'outbound'),
  from_email text,
  to_email text,
  subject text,
  body_html text,
  body_plain text,
  is_auto_reply boolean DEFAULT false,
  created_at timestamptz
)

follow_ups (
  id uuid PK,
  thread_id uuid FK → email_threads,
  campaign_id uuid FK → campaigns,
  journalist_id uuid FK → journalists,
  type enum('auto_scheduled', 'manual', 'ai_suggested'),
  status enum('scheduled', 'sent', 'cancelled'),
  scheduled_at timestamptz,
  content_html text,
  ai_rationale text, -- pourquoi cette relance est recommandée
  sent_at timestamptz,
  created_at timestamptz
)

-- RETOMBÉES PRESSE
press_clippings (
  id uuid PK,
  campaign_id uuid FK → campaigns,
  client_id uuid FK → clients,
  journalist_id uuid FK → journalists (nullable),
  -- Contenu
  title text,
  url text,
  source_name text, -- nom du média
  source_type enum('presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'social_media'),
  published_at timestamptz,
  excerpt text,
  screenshot_url text,
  -- Métriques
  estimated_reach bigint,
  estimated_ave numeric, -- Advertising Value Equivalent
  sentiment enum('positive', 'neutral', 'negative', 'mixed'),
  -- Détection
  detection_method enum('manual', 'google_news', 'monitoring', 'journalist_shared'),
  is_verified boolean DEFAULT false,
  -- IA
  ai_summary text,
  ai_key_messages_found text[], -- messages clés du CP retrouvés dans l'article
  created_at timestamptz
)

-- MONITORING & ALERTES
monitoring_queries (
  id uuid PK,
  organization_id uuid FK → organizations,
  client_id uuid FK → clients (nullable),
  campaign_id uuid FK → campaigns (nullable),
  query_terms text[], -- termes de recherche
  is_active boolean DEFAULT true,
  check_interval_hours integer DEFAULT 6,
  last_checked_at timestamptz,
  created_at timestamptz
)

monitoring_results (
  id uuid PK,
  query_id uuid FK → monitoring_queries,
  url text,
  title text,
  snippet text,
  source text,
  published_at timestamptz,
  is_relevant boolean, -- déterminé par l'IA
  is_converted_to_clipping boolean DEFAULT false, -- lié à un press_clipping
  created_at timestamptz
)

-- BOUCLES D'AMÉLIORATION
improvement_cycles (
  id uuid PK,
  organization_id uuid FK → organizations,
  type enum('email_timing', 'subject_lines', 'journalist_targeting', 'content_quality', 'follow_up_strategy', 'database_enrichment'),
  status enum('collecting_data', 'analyzing', 'recommending', 'testing', 'validating', 'applied'),
  -- Données du cycle
  data_snapshot jsonb, -- données analysées
  analysis jsonb, -- résultat de l'analyse IA
  recommendations jsonb, -- recommandations générées
  test_config jsonb, -- configuration du test
  test_results jsonb, -- résultats du test
  validation_notes text, -- notes de validation humaine
  validated_by uuid FK → users,
  validated_at timestamptz,
  created_at timestamptz,
  completed_at timestamptz
)

-- A/B TESTING
ab_tests (
  id uuid PK,
  campaign_id uuid FK → campaigns,
  type enum('subject_line', 'content_angle', 'send_time', 'personalization'),
  variant_a jsonb,
  variant_b jsonb,
  status enum('running', 'completed', 'cancelled'),
  winner text, -- 'A', 'B', ou 'inconclusive'
  results jsonb,
  started_at timestamptz,
  completed_at timestamptz
)

-- TEMPLATES & ASSETS
templates (
  id uuid PK,
  organization_id uuid FK → organizations,
  name text,
  type enum('press_release', 'follow_up', 'response', 'pitch'),
  content_html text,
  variables jsonb, -- variables dynamiques disponibles
  usage_count integer DEFAULT 0,
  created_at timestamptz
)

-- NOTIFICATIONS
notifications (
  id uuid PK,
  user_id uuid FK → users,
  type enum('journalist_replied', 'article_published', 'campaign_milestone', 'approval_needed', 'system_alert', 'improvement_ready'),
  title text,
  message text,
  data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz
)

-- AUDIT LOG
audit_log (
  id uuid PK,
  organization_id uuid FK → organizations,
  user_id uuid FK → users,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz
)
```

### Row Level Security (RLS)
Toutes les tables DOIVENT avoir RLS activé. Chaque utilisateur ne voit que les données de son `organization_id`. Les `client_viewer` ne voient que les données du client associé. Implémente des policies Supabase strictes.

### Indexes critiques
```sql
CREATE INDEX idx_journalists_org ON journalists(organization_id);
CREATE INDEX idx_journalists_email ON journalists(email);
CREATE INDEX idx_journalists_quality ON journalists(quality_score DESC);
CREATE INDEX idx_campaigns_client ON campaigns(client_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX idx_email_sends_journalist ON email_sends(journalist_id);
CREATE INDEX idx_email_sends_status ON email_sends(status);
CREATE INDEX idx_press_clippings_campaign ON press_clippings(campaign_id);
CREATE INDEX idx_monitoring_results_query ON monitoring_results(query_id);
CREATE INDEX idx_email_threads_status ON email_threads(status);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;
```

---

## 🧠 MODULES IA (Claude API)

### 1. Rédaction de communiqués
- **Input** : brief client, messages clés, ton souhaité, cible journaliste
- **Output** : communiqué complet avec titre, sous-titre, corps, citation, boilerplate
- **Prompt engineering** : le système doit produire du contenu RP professionnel en français, avec la structure standard (qui, quoi, quand, où, pourquoi, comment), un titre accrocheur orienté média, et un angle journalistique clair
- L'utilisateur peut éditer manuellement OU donner des instructions à l'IA pour modifier ("rends l'accroche plus percutante", "ajoute des chiffres", "simplifie le jargon technique")

### 2. Scoring de qualité des communiqués
Avant envoi, l'IA analyse et note le communiqué sur :
- **Accroche** (0-100) : le titre et le premier paragraphe donnent-ils envie de lire ?
- **Lisibilité** (0-100) : clarté, longueur des phrases, jargon
- **Structure** (0-100) : respect des codes RP, pyramide inversée
- **Angle média** (0-100) : est-ce que c'est une info ou une pub déguisée ?
- **Score global** avec recommandations d'amélioration concrètes

### 3. Personnalisation des envois
Pour chaque journaliste ciblé, l'IA génère :
- Un objet d'email personnalisé
- Une accroche d'intro personnalisée (1-2 phrases) basée sur le beat du journaliste, ses articles récents, son historique d'interactions
- Le corps du communiqué reste identique

### 4. Analyse des réponses
Quand un journaliste répond :
- Classification automatique du sentiment (intéressé, pas intéressé, demande d'info, hors sujet)
- Suggestion de réponse adaptée
- Scoring de priorité (un journaliste du Monde intéressé > un blogueur qui dit "peut-être")
- Stratégie de relance recommandée

### 5. Recommandations de relance
L'IA décide :
- Faut-il relancer ? (oui/non avec justification)
- Quand ? (timing optimal basé sur les données historiques)
- Comment ? (angle de relance différent du premier envoi)
- Génère le contenu de la relance

### 6. Analyse de campagne
À la fin de chaque campagne ou sur demande :
- Résumé des performances vs objectifs
- Ce qui a marché / pas marché
- Recommandations pour la prochaine campagne
- Comparaison avec les campagnes précédentes du même client

### 7. Enrichissement de la base journalistes
Cycle automatique :
- Vérification des emails (détection bounces, changements de poste)
- Recherche d'infos complémentaires (nouveaux articles publiés, changement de média)
- Mise à jour des thématiques couvertes
- Détection de journalistes potentiellement pertinents à ajouter
- Nettoyage : fusion des doublons, suppression des contacts invalides
- **Toute modification substantielle doit être validée par un humain avant application**

### 8. Boucles d'auto-amélioration
Le système exécute des cycles d'amélioration continue :

**Cycle 1 — Timing d'envoi**
- Collecte les données d'ouverture par heure/jour
- Analyse les patterns par type de journaliste
- Recommande des créneaux optimaux
- Teste sur la campagne suivante
- Valide et ajuste

**Cycle 2 — Objets d'email**
- A/B test automatique sur les objets
- Analyse des taux d'ouverture par style d'objet
- Affine les templates de personnalisation
- Génère des variantes de plus en plus performantes

**Cycle 3 — Ciblage journalistes**
- Analyse les taux de réponse et publication par profil
- Identifie les profils les plus réceptifs par type de campagne
- Recommande des listes de diffusion optimisées
- Apprend des succès et échecs passés

**Cycle 4 — Qualité du contenu**
- Corrèle le score de qualité avec les retombées réelles
- Ajuste les critères de scoring
- Identifie les patterns de contenu qui génèrent des publications
- Affine les prompts de rédaction IA

**Cycle 5 — Stratégie de relance**
- Analyse quelles relances ont mené à des publications
- Optimise le timing et le contenu des relances
- Teste différentes approches (nouvel angle, rappel simple, exclusivité)

---

## 📧 SYSTÈME D'EMAILS

### Architecture d'envoi (Resend)
- **Domaine principal** : `hermespressroom.com` configuré dans Resend
- Sous-domaines par client si nécessaire (ex: `clientname.hermespressroom.com`) ou alias d'expéditeur
- SPF, DKIM, DMARC configurés sur `hermespressroom.com` (guide fourni au product owner)
- Nom d'expéditeur + signature personnalisés par client dans la config (ex: "Marie Dupont — Hermès Press Room pour [Client]")
- Rate limiting : max 50 emails/heure pour protéger la réputation du domaine
- File d'attente avec retry automatique sur les échecs temporaires

### Tracking (via webhooks Resend)
- Endpoint webhook Supabase Edge Function : `/api/webhooks/resend`
- Événements trackés : `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
- Mise à jour temps réel de `email_sends` et des métriques agrégées de `campaigns`

### Réception des réponses
- **Option principale** : Webhook Resend pour les réponses (inbound email)
- **Alternative** : Connexion IMAP périodique via Edge Function (toutes les 5 min)
- Les réponses sont parsées, associées au bon thread/campagne/journaliste
- L'IA analyse immédiatement chaque réponse entrante
- Notification temps réel à l'utilisateur

### Gestion des opt-out
- Lien de désinscription dans chaque email (obligatoire RGPD)
- Traitement automatique des désabonnements
- Le journaliste est marqué `is_opted_out = true` et ne recevra plus jamais d'email
- Liste noire globale synchronisée

---

## 🖥️ INTERFACE UTILISATEUR

### Design System
- **Aesthetic** : Luxe discret, précision suisse, efficacité — inspiré de Linear pour l'UX, de l'univers Hermès pour l'élégance. Chaque pixel sert à quelque chose mais avec une touche premium
- **Palette** : 
  - Fond principal : noir profond (#0A0A0B) en dark mode (par défaut), blanc cassé (#FAFAF9) en light mode
  - Accent primaire : or/bronze (#B8860B) — utilisé avec parcimonie pour les actions importantes et éléments de marque
  - Accent secondaire : bleu nuit (#1E3A5F) — pour les éléments interactifs courants
  - Statuts : vert (#22C55E) succès, orange (#F59E0B) attention, rouge (#EF4444) erreur
  - Texte : blanc/gris clair en dark, noir/gris foncé en light
- **Typographie** : DM Sans pour les titres, Inter pour le corps (exception justifiée : c'est un outil pro utilisé des heures, la lisibilité prime)
- **Logo** : affiché en sidebar (version icône) et en page de login (version complète avec texte "Hermès Press Room")
- **Composants** : shadcn/ui comme base, customisés avec la palette HPR
- **Responsive** : Desktop-first (c'est un outil de travail), mais utilisable sur tablette
- **Animations** : Subtiles, fonctionnelles (transitions de page, feedback d'actions). Pas d'animations décoratives. Les éléments dorés peuvent avoir un léger shimmer au hover

### Pages & Navigation

#### Sidebar principale
```
📊 Dashboard (vue agence)
👥 Clients
📋 Campagnes
✉️ Communiqués
👤 Journalistes
📬 Boîte de réception (réponses)
📈 Retombées presse
🔄 Amélioration continue
⚙️ Paramètres
```

#### 1. Dashboard Agence (`/dashboard`)
- Vue d'ensemble multi-clients
- KPIs globaux : campagnes actives, emails envoyés cette semaine, taux d'ouverture moyen, retombées du mois
- Timeline d'activité récente
- Alertes et notifications en attente
- Campagnes en cours avec mini-barres de progression
- Top journalistes réactifs du mois

#### 2. Gestion des Clients (`/clients`)
- Liste des clients avec logo, secteur, nombre de campagnes
- Fiche client détaillée :
  - Infos générales et config
  - Configuration de l'expéditeur email (nom, email, signature)
  - Historique des campagnes
  - Retombées presse agrégées
  - Journalistes les plus réceptifs pour ce client

#### 3. Campagnes (`/campaigns`)
- **Liste** : filtrable par client, statut, tags, mots-clés, date
- **Création** : wizard en étapes (brief → rédaction → ciblage → revue → envoi)
- **Vue détaillée d'une campagne** :
  - Header avec statut, client, dates, tags
  - Onglet "Communiqué" : éditeur riche avec assistance IA
  - Onglet "Ciblage" : sélection des journalistes, suggestions IA
  - Onglet "Envoi" : programmation, A/B testing, prévisualisation
  - Onglet "Suivi" : tracking temps réel (ouvertures, clics, réponses)
  - Onglet "Réponses" : fils de conversation avec suggestions IA
  - Onglet "Retombées" : articles publiés liés à cette campagne
  - Onglet "Rapport" : synthèse complète exportable en PDF

#### 4. Éditeur de Communiqués (`/campaigns/[id]/press-release`)
- Éditeur WYSIWYG riche (Tiptap recommandé)
- Panneau latéral IA :
  - Score de qualité en temps réel
  - Suggestions d'amélioration cliquables
  - Bouton "Réécrire cette section" sur chaque paragraphe
  - Chat libre : "Rends ça plus punchy", "Ajoute un chiffre ici"
- Historique des versions avec diff visuel
- Prévisualisation email (comment le journaliste le verra)
- Mode "validation client" : vue simplifiée pour approbation

#### 5. Base Journalistes (`/journalists`)
- **Liste** : recherche full-text, filtres par média, thématique, score, dernière interaction
- **Fiche journaliste** :
  - Infos de contact et profil
  - Score de qualité avec détail (réactivité, taux de publication, etc.)
  - Historique complet des interactions (tous clients confondus)
  - Articles récents (via monitoring)
  - Tags et notes
- **Import** : CSV/Excel avec mapping de colonnes intelligent
- **Enrichissement** : bouton "Enrichir cette fiche" + cycle auto en background
- **Nettoyage** : vue "À vérifier" avec les contacts suspects (bounces, anciens, doublons)
- **Suggestions** : "Journalistes similaires que vous ne contactez pas encore"

#### 6. Boîte de Réception (`/inbox`)
- Style inbox email classique mais spécialisé RP
- Vue par campagne ou vue globale
- Chaque conversation affiche :
  - Nom du journaliste et média
  - Campagne associée
  - Sentiment détecté (badge couleur)
  - Priorité (haute si journaliste influent + sentiment positif)
  - Réponse suggérée par l'IA (dépliable)
- Actions rapides : répondre, planifier relance, marquer comme traité, associer à une retombée

#### 7. Retombées Presse (`/clippings`)
- Grille de cartes avec aperçu (screenshot, titre, source, date)
- Ajout manuel : coller un URL → extraction automatique des métadonnées
- Ajout automatique via monitoring
- Vue par campagne, par client, par période
- Métriques : reach total, AVE, nombre d'articles, répartition par type de média
- Export PDF pour rapport client

#### 8. Module d'Amélioration Continue (`/improvements`)
- Dashboard des cycles en cours
- Pour chaque cycle :
  - Phase actuelle (collecte → analyse → recommandation → test → validation)
  - Données collectées (graphiques)
  - Recommandations de l'IA
  - Bouton "Lancer un test" et "Valider les résultats"
- Historique des améliorations appliquées avec impact mesuré
- Score de maturité global de la plateforme

#### 9. Paramètres (`/settings`)
- Organisation : nom, logo, membres de l'équipe
- Clients : CRUD + configuration email par client
- Intégrations : Resend (domaines), Slack (webhooks de notification)
- Templates : bibliothèque de modèles de communiqués/relances/réponses
- Monitoring : gestion des requêtes de veille
- Emails : configuration des séquences de relance automatique
- IA : ajustement du ton, du style, des règles de rédaction

---

## 📊 SYSTÈME DE REPORTING

### Rapport de campagne (exportable PDF)
Structure du rapport :
1. **Page de garde** : nom de la campagne, client, période, logo
2. **Résumé exécutif** : 3-4 lignes générées par l'IA
3. **KPIs clés** : envois, ouvertures, réponses, retombées (avec comparaison vs moyenne)
4. **Détail des envois** : tableau des journalistes contactés avec statut
5. **Retombées presse** : liste des articles avec screenshots, reach, sentiment
6. **Analyse qualitative** : points forts, points d'amélioration (IA)
7. **Recommandations** : pour la prochaine campagne (IA)

### Dashboard temps réel
- Graphiques : évolution des ouvertures/réponses dans le temps, funnel de conversion (envoyé → ouvert → répondu → publié)
- Comparaison inter-campagnes
- Heatmap des meilleurs horaires d'envoi
- Distribution géographique et par type de média des retombées

---

## 🔄 MONITORING DES RETOMBÉES

### Sources
1. **Google News RSS** : flux RSS par requête de recherche, vérifié toutes les 4-6h
2. **Recherche web périodique** : requêtes ciblées via API de recherche
3. **Ajout manuel** : l'utilisateur colle un URL, le système extrait tout automatiquement

### Pipeline de traitement
1. Nouvelle URL détectée par le monitoring
2. Extraction des métadonnées : titre, auteur, date, excerpt, média
3. Analyse IA : est-ce pertinent pour une campagne en cours ? Quel sentiment ?
4. Si pertinent : création automatique d'un `press_clipping` en brouillon
5. Notification à l'utilisateur pour validation
6. Si validé : lien avec la campagne, mise à jour des métriques

### Capture de screenshots
- Utilisation d'un service de capture de page (ou Puppeteer via Edge Function)
- Stockage dans Supabase Storage
- Sert de preuve et pour l'affichage dans les rapports

---

## 🔐 SÉCURITÉ & RGPD

### Authentification
- Supabase Auth avec email/password
- Magic link en option
- Invitation par email pour les nouveaux membres et les clients

### Autorisations (RBAC)
| Action | Admin | Manager | Member | Client Viewer |
|--------|-------|---------|--------|---------------|
| Gérer l'organisation | ✅ | ❌ | ❌ | ❌ |
| Gérer les clients | ✅ | ✅ | ❌ | ❌ |
| Créer une campagne | ✅ | ✅ | ✅ | ❌ |
| Envoyer des emails | ✅ | ✅ | ❌ | ❌ |
| Approuver un communiqué | ✅ | ✅ | ❌ | ✅ |
| Voir les rapports | ✅ | ✅ | ✅ | ✅ (son client uniquement) |
| Gérer les journalistes | ✅ | ✅ | ✅ | ❌ |
| Module d'amélioration | ✅ | ✅ | ❌ | ❌ |

### RGPD
- Consentement explicite avant tout envoi (les journalistes importés ne sont PAS automatiquement contactables)
- Registre des traitements documenté
- Droit d'accès, de rectification, de suppression implémenté
- Durée de conservation des données configurable
- Export des données sur demande
- Lien de désinscription dans chaque email

---

## 🚀 PLAN DE DÉVELOPPEMENT

### V1 — MVP Fonctionnel (priorité absolue)
1. Auth + organisation + RBAC basique (admin/member)
2. CRUD clients avec config expéditeur
3. CRUD journalistes + import CSV + scoring basique
4. Création de campagne + éditeur de communiqués avec IA
5. Envoi d'emails via Resend + tracking
6. Boîte de réception des réponses + suggestions IA
7. Dashboard avec KPIs essentiels
8. Retombées presse (ajout manuel + monitoring Google News)
9. Export PDF basique des rapports

### V2 — Intelligence, Automatisation & Internationalisation
1. A/B testing des objets d'email
2. Relances automatiques avec validation
3. Circuit de validation client (client_viewer)
4. Enrichissement automatique de la base journalistes
5. Boucles d'amélioration continue (5 cycles)
6. Reporting avancé avec comparaisons et tendances
7. Templates de communiqués et réponses
8. Notifications Slack
9. Scoring avancé des journalistes
10. Suggestions de journalistes à ajouter
11. **Multilingue complet (i18n)** :
    - Architecture : `next-intl` pour le framework i18n
    - Fichiers de traduction JSON par locale dans `/messages/{locale}.json`
    - Langues V2 : Français (défaut), Anglais, Espagnol, Allemand
    - Tout le contenu statique de l'UI doit être externalisé dans des clés de traduction dès la V1 (même si une seule langue est active) pour faciliter la migration V2
    - Les communiqués de presse et contenus IA restent dans la langue choisie par l'utilisateur pour chaque campagne
    - Le switch de langue se fait dans les paramètres utilisateur
    - Les emails système (notifications, invitations) sont envoyés dans la langue de l'utilisateur
    - Les rapports PDF sont générés dans la langue du client concerné

**IMPORTANT pour la V1** : même si le multilingue n'est activé qu'en V2, toutes les chaînes de caractères de l'interface DOIVENT utiliser des clés de traduction dès le départ (`t('dashboard.title')` et non `"Tableau de bord"` en dur). Cela évitera un refactoring massif. Prépare la structure `next-intl` dès le setup initial avec le français comme seule locale active.

---

## 📏 RÈGLES DE DÉVELOPPEMENT

### Code
- TypeScript strict partout (no `any`)
- Server Components par défaut, Client Components uniquement quand nécessaire
- Server Actions pour les mutations
- Gestion d'erreurs systématique avec des messages clairs
- Logging structuré pour le debug
- Pas de `console.log` en production

### Base de données
- Toutes les requêtes passent par le client Supabase typé (généré avec `supabase gen types`)
- RLS sur TOUTES les tables sans exception
- Migrations versionnées et traçables
- Pas de requêtes SQL brutes dans le frontend

### Performance
- Streaming SSR pour les pages lourdes
- Pagination côté serveur pour toutes les listes
- Debounce sur les recherches
- Optimistic updates pour les actions fréquentes
- Images optimisées via Next.js Image
- Cache des appels IA (ne pas rappeler Claude pour le même scoring)

### UX
- Loading states sur chaque action asynchrone
- Messages de succès/erreur explicites (toasts)
- Confirmation avant toute action destructrice
- Navigation au clavier fonctionnelle
- Empty states informatifs et engageants (pas de pages blanches)
- Feedback immédiat sur chaque interaction

### IA
- Tous les appels à Claude passent par une couche d'abstraction centralisée (`lib/ai/`)
- Chaque prompt est versionné et documenté
- Les réponses IA sont toujours éditables par l'humain
- Un fallback existe si l'API Claude est indisponible
- Les coûts d'API sont loggués pour suivi

---

## 🧪 TESTS & QUALITÉ

- Chaque module doit fonctionner de manière isolée avant intégration
- Tester les Edge Functions avec des données réalistes
- Vérifier les webhooks Resend avec le mode test
- S'assurer que le RLS bloque bien les accès non autorisés
- Tester les cas limites : email invalide, journaliste opt-out, campagne sans communiqué, etc.
- L'éditeur de communiqués doit fonctionner de manière fluide avec du contenu long

---

## 📝 CONVENTIONS DE NOMMAGE

- **Fichiers** : kebab-case (`press-release-editor.tsx`)
- **Composants** : PascalCase (`PressReleaseEditor`)
- **Variables/fonctions** : camelCase (`getJournalistScore`)
- **Tables DB** : snake_case pluriel (`press_releases`)
- **API routes** : kebab-case (`/api/press-releases`)
- **Types** : PascalCase avec suffixe (`JournalistRow`, `CampaignInsert`)

---

## 💡 PHILOSOPHIE

**Hermès Press Room** doit donner un avantage compétitif réel à une petite agence RP. Chaque feature doit faire gagner du temps ou améliorer les résultats. L'IA n'est pas un gadget — elle est le moteur qui transforme un outil de gestion en un accélérateur de performance.

Le produit doit être si bien conçu qu'un attaché de presse senior dirait : "C'est exactement comme ça que je travaillerais si j'avais un assistant parfait."

Construis chaque module comme si c'était un produit SaaS premium que des agences paieraient cher pour utiliser. Le nom Hermès n'est pas un hasard — cette plateforme doit incarner l'excellence dans la livraison du message.
