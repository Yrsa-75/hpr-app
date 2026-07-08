-- ============================================
-- HPR — Migration 006
-- Système de scraping autonome de journalistes
-- Pool global + tables de scraping
-- ============================================

-- ============================================
-- PART 1 : Pool global de journalistes
-- Rendre organization_id nullable pour permettre
-- des journalistes "globaux" visibles par toutes les orgs
-- ============================================

-- Rendre organization_id nullable
ALTER TABLE journalists
  ALTER COLUMN organization_id DROP NOT NULL;

-- Remplacer ON DELETE CASCADE par ON DELETE SET NULL
-- (on ne veut pas supprimer un journaliste global si l'org est supprimée)
ALTER TABLE journalists
  DROP CONSTRAINT journalists_organization_id_fkey;

ALTER TABLE journalists
  ADD CONSTRAINT journalists_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE SET NULL;

-- Colonne is_global
ALTER TABLE journalists
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- URL source (page de laquelle le journaliste a été extrait)
ALTER TABLE journalists
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Index partiel pour unicité email des journalistes globaux
CREATE UNIQUE INDEX IF NOT EXISTS journalists_global_email_unique
  ON journalists(email)
  WHERE is_global = true;

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_journalists_is_global ON journalists(is_global) WHERE is_global = true;

-- ============================================
-- PART 2 : Update RLS — permettre la lecture des journalistes globaux
-- ============================================

-- Supprimer l'ancienne policy de lecture
DROP POLICY IF EXISTS "Users can view journalists in their organization" ON journalists;

-- Nouvelle policy : voir son org OU les journalistes globaux
CREATE POLICY "Users can view journalists in their organization or global"
  ON journalists FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    OR is_global = true
  );

-- La policy d'insertion reste inchangée (seul service_role peut insérer des journalistes globaux)
-- Les policies UPDATE/DELETE existantes restent sur organization_id uniquement

-- ============================================
-- PART 3 : Sources de scraping
-- Liste des médias français à scraper
-- ============================================

CREATE TABLE IF NOT EXISTS scraping_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_name TEXT NOT NULL,
  media_domain TEXT NOT NULL,
  team_page_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'influenceur')),
  category TEXT, -- 'national', 'economie', 'tech', 'tv_radio', 'regional', 'magazine', 'specialise'
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1=priorité haute
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'error', 'skipped')),
  last_scraped_at TIMESTAMPTZ,
  next_scrape_at TIMESTAMPTZ DEFAULT NOW(), -- planification du prochain scraping
  journalist_count_found INTEGER DEFAULT 0,
  error_message TEXT,
  scrape_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_page_url)
);

CREATE INDEX IF NOT EXISTS idx_scraping_sources_status ON scraping_sources(status);
CREATE INDEX IF NOT EXISTS idx_scraping_sources_next_scrape ON scraping_sources(next_scrape_at) WHERE status != 'skipped';

-- ============================================
-- PART 4 : Suivi du budget mensuel API
-- ============================================

CREATE TABLE IF NOT EXISTS scraping_budget_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month TEXT NOT NULL, -- format 'YYYY-MM'
  api_calls INTEGER DEFAULT 0,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  estimated_cost_eur NUMERIC(10, 4) DEFAULT 0,
  budget_limit_eur NUMERIC(10, 4) DEFAULT 200.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month)
);

-- ============================================
-- PART 5 : Log des opérations de scraping
-- ============================================

CREATE TABLE IF NOT EXISTS scraping_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES scraping_sources(id) ON DELETE SET NULL,
  media_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped_budget', 'skipped_empty')),
  journalists_added INTEGER DEFAULT 0,
  journalists_updated INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_eur NUMERIC(8, 4) DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraping_log_created ON scraping_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraping_log_source ON scraping_log(source_id);

-- ============================================
-- PART 6 : Seed — médias français
-- ~300 médias couvrant toutes les catégories
-- ============================================

INSERT INTO scraping_sources (media_name, media_domain, team_page_url, media_type, category, priority) VALUES

-- === PRESSE NATIONALE (priorité 1) ===
('Le Monde', 'lemonde.fr', 'https://www.lemonde.fr/journalistes/', 'presse_ecrite', 'national', 1),
('Le Figaro', 'lefigaro.fr', 'https://www.lefigaro.fr/redaction/', 'presse_ecrite', 'national', 1),
('Libération', 'liberation.fr', 'https://www.liberation.fr/equipe/', 'presse_ecrite', 'national', 1),
('L''Express', 'lexpress.fr', 'https://www.lexpress.fr/journalistes/', 'presse_ecrite', 'national', 1),
('Le Point', 'lepoint.fr', 'https://www.lepoint.fr/journalistes/', 'presse_ecrite', 'national', 1),
('L''Obs', 'nouvelobs.com', 'https://www.nouvelobs.com/auteurs/', 'presse_ecrite', 'national', 1),
('L''Humanité', 'humanite.fr', 'https://www.humanite.fr/redaction', 'presse_ecrite', 'national', 2),
('La Croix', 'la-croix.com', 'https://www.la-croix.com/redaction/', 'presse_ecrite', 'national', 2),
('Marianne', 'marianne.net', 'https://www.marianne.net/auteurs', 'presse_ecrite', 'national', 2),
('Le Journal du Dimanche', 'lejdd.fr', 'https://www.lejdd.fr/equipe-redactionnelle', 'presse_ecrite', 'national', 2),
('Paris Match', 'parismatch.com', 'https://www.parismatch.com/redaction/', 'presse_ecrite', 'national', 2),
('L''Opinion', 'lopinion.fr', 'https://www.lopinion.fr/journalistes', 'presse_ecrite', 'national', 2),
('Valeurs Actuelles', 'valeursactuelles.com', 'https://www.valeursactuelles.com/redaction/', 'presse_ecrite', 'national', 3),
('Charlie Hebdo', 'charliehebdo.fr', 'https://charliehebdo.fr/redaction/', 'presse_ecrite', 'national', 3),
('Le Canard Enchaîné', 'lecanardenchaine.fr', 'https://www.lecanardenchaine.fr/equipe', 'presse_ecrite', 'national', 3),

-- === PRESSE ÉCONOMIQUE (priorité 1) ===
('Les Echos', 'lesechos.fr', 'https://www.lesechos.fr/journalistes/', 'presse_ecrite', 'economie', 1),
('Le Monde Économie', 'lemonde.fr', 'https://www.lemonde.fr/economie/', 'presse_ecrite', 'economie', 1),
('La Tribune', 'latribune.fr', 'https://www.latribune.fr/redaction/', 'presse_ecrite', 'economie', 1),
('Capital', 'capital.fr', 'https://www.capital.fr/auteurs/', 'presse_ecrite', 'economie', 2),
('Challenges', 'challenges.fr', 'https://www.challenges.fr/auteurs/', 'presse_ecrite', 'economie', 2),
('L''Usine Nouvelle', 'usinenouvelle.com', 'https://www.usinenouvelle.com/auteurs/', 'presse_ecrite', 'economie', 2),
('L''Expansion', 'lexpansion.lexpress.fr', 'https://www.lexpansion.lexpress.fr/auteurs/', 'presse_ecrite', 'economie', 2),
('BFM Business', 'bfmtv.com', 'https://www.bfmtv.com/economie/journalistes/', 'tv', 'economie', 2),
('Mieux Vivre Votre Argent', 'mieuxvivre-votre-argent.fr', 'https://www.mieuxvivre-votre-argent.fr/auteurs/', 'presse_ecrite', 'economie', 3),
('Option Finance', 'optionfinance.fr', 'https://www.optionfinance.fr/redaction/', 'presse_ecrite', 'economie', 3),
('L''Agefi', 'agefi.fr', 'https://www.agefi.fr/redaction/', 'presse_ecrite', 'economie', 2),
('Décideurs Magazine', 'magazine-decideurs.com', 'https://www.magazine-decideurs.com/auteurs/', 'presse_ecrite', 'economie', 3),

-- === TV & ACTUALITÉ WEB (priorité 1) ===
('BFM TV', 'bfmtv.com', 'https://www.bfmtv.com/journalistes/', 'tv', 'tv_radio', 1),
('CNews', 'cnews.fr', 'https://www.cnews.fr/equipe/', 'tv', 'tv_radio', 1),
('LCI', 'lci.fr', 'https://www.lci.fr/equipe/', 'tv', 'tv_radio', 1),
('France Info', 'francetvinfo.fr', 'https://www.francetvinfo.fr/redaction/', 'web', 'tv_radio', 1),
('20 Minutes', '20minutes.fr', 'https://www.20minutes.fr/journalistes/', 'web', 'national', 1),
('Le HuffPost', 'huffingtonpost.fr', 'https://www.huffingtonpost.fr/auteurs/', 'web', 'national', 1),
('Slate.fr', 'slate.fr', 'https://www.slate.fr/auteurs', 'web', 'national', 2),
('Mediapart', 'mediapart.fr', 'https://www.mediapart.fr/equipe-redactionnelle', 'web', 'national', 1),
('Arrêt sur Images', 'arretsurimages.net', 'https://www.arretsurimages.net/equipe', 'web', 'national', 3),
('The Conversation France', 'theconversation.com', 'https://theconversation.com/fr/equipe', 'web', 'national', 3),
('Reporterre', 'reporterre.net', 'https://reporterre.net/spip.php?rubrique87', 'web', 'national', 3),
('Bastamag', 'basta.media', 'https://basta.media/redaction', 'web', 'national', 3),
('Binge Audio', 'binge.audio', 'https://www.binge.audio/equipe', 'podcast', 'national', 3),
('Konbini', 'konbini.com', 'https://www.konbini.com/fr/redaction/', 'web', 'national', 3),

-- === RADIO (priorité 2) ===
('France Inter', 'radiofrance.fr', 'https://www.radiofrance.fr/franceinter/equipe', 'radio', 'tv_radio', 1),
('RTL', 'rtl.fr', 'https://www.rtl.fr/actu/journalistes', 'radio', 'tv_radio', 1),
('Europe 1', 'europe1.fr', 'https://www.europe1.fr/redaction/', 'radio', 'tv_radio', 2),
('France Info Radio', 'radiofrance.fr', 'https://www.radiofrance.fr/franceinfo/equipe', 'radio', 'tv_radio', 2),
('France Culture', 'radiofrance.fr', 'https://www.radiofrance.fr/franceculture/equipe', 'radio', 'tv_radio', 2),
('RFI', 'rfi.fr', 'https://www.rfi.fr/fr/redaction/', 'radio', 'tv_radio', 2),
('BFM Radio', 'bfmtv.com', 'https://www.bfmtv.com/bfm-radio/journalistes/', 'radio', 'tv_radio', 3),
('Sud Radio', 'sudradio.fr', 'https://www.sudradio.fr/equipe/', 'radio', 'tv_radio', 3),
('RMC', 'rmc.fr', 'https://www.rmc.fr/redaction/', 'radio', 'tv_radio', 2),
('Franceinfo Culture', 'radiofrance.fr', 'https://www.radiofrance.fr/francemusique/equipe', 'radio', 'tv_radio', 3),

-- === TECH & NUMÉRIQUE (priorité 2) ===
('01net', '01net.com', 'https://www.01net.com/auteurs/', 'web', 'tech', 1),
('Journal du Net', 'journaldunet.com', 'https://www.journaldunet.com/auteurs/', 'web', 'tech', 1),
('ZDNet France', 'zdnet.fr', 'https://www.zdnet.fr/auteurs/', 'web', 'tech', 1),
('Numerama', 'numerama.com', 'https://www.numerama.com/auteurs/', 'web', 'tech', 1),
('Frandroid', 'frandroid.com', 'https://www.frandroid.com/auteurs/', 'web', 'tech', 1),
('NextINpact', 'nextinpact.com', 'https://www.nextinpact.com/auteurs/', 'web', 'tech', 2),
('Clubic', 'clubic.com', 'https://www.clubic.com/auteurs/', 'web', 'tech', 2),
('Tom''s Hardware France', 'tomshardware.fr', 'https://www.tomshardware.fr/auteurs/', 'web', 'tech', 2),
('Les Numériques', 'lesnumeriques.com', 'https://www.lesnumeriques.com/auteurs/', 'web', 'tech', 2),
('Silicon.fr', 'silicon.fr', 'https://www.silicon.fr/auteurs/', 'web', 'tech', 2),
('L''Informé', 'linforme.com', 'https://linforme.com/auteurs/', 'web', 'tech', 2),
('Siècle Digital', 'siecle-digital.fr', 'https://siecledigital.fr/auteurs/', 'web', 'tech', 3),
('FrenchWeb', 'frenchweb.fr', 'https://www.frenchweb.fr/auteurs/', 'web', 'tech', 2),
('L''ADN', 'ladn.eu', 'https://www.ladn.eu/auteurs/', 'web', 'tech', 3),
('Usbeketrica', 'usbeketrica.com', 'https://usbeketrica.com/auteurs/', 'web', 'tech', 3),
('Maddyness', 'maddyness.com', 'https://www.maddyness.com/auteurs/', 'web', 'tech', 2),
('La Revue du Digital', 'larevuedudigital.com', 'https://www.larevuedudigital.com/auteurs/', 'web', 'tech', 3),
('Le Monde Informatique', 'lemondeinformatique.fr', 'https://www.lemondeinformatique.fr/auteurs/', 'web', 'tech', 2),
('L''Informaticien', 'linformaticien.com', 'https://www.linformaticien.com/auteurs/', 'web', 'tech', 3),
('Industrie & Technologies', 'industrie-techno.com', 'https://www.industrie-techno.com/auteurs/', 'web', 'tech', 3),

-- === PRESSE RÉGIONALE (priorité 3) ===
('Ouest-France', 'ouest-france.fr', 'https://www.ouest-france.fr/redaction/', 'presse_ecrite', 'regional', 2),
('La Dépêche du Midi', 'ladepeche.fr', 'https://www.ladepeche.fr/redaction/', 'presse_ecrite', 'regional', 2),
('Sud Ouest', 'sudouest.fr', 'https://www.sudouest.fr/redaction/', 'presse_ecrite', 'regional', 2),
('Le Télégramme', 'letelegramme.fr', 'https://www.letelegramme.fr/redaction/', 'presse_ecrite', 'regional', 2),
('Nice-Matin', 'nicematin.com', 'https://www.nicematin.com/redaction/', 'presse_ecrite', 'regional', 3),
('La Montagne', 'lamontagne.fr', 'https://www.lamontagne.fr/redaction/', 'presse_ecrite', 'regional', 3),
('L''Est Républicain', 'estrepublicain.fr', 'https://www.estrepublicain.fr/redaction/', 'presse_ecrite', 'regional', 3),
('Le Progrès', 'leprogres.fr', 'https://www.leprogres.fr/redaction/', 'presse_ecrite', 'regional', 3),
('La Voix du Nord', 'lavoixdunord.fr', 'https://www.lavoixdunord.fr/redaction/', 'presse_ecrite', 'regional', 3),
('Le Dauphiné Libéré', 'ledauphine.com', 'https://www.ledauphine.com/redaction/', 'presse_ecrite', 'regional', 3),
('Midi Libre', 'midilibre.fr', 'https://www.midilibre.fr/redaction/', 'presse_ecrite', 'regional', 3),
('La Nouvelle République', 'lanouvellerepublique.fr', 'https://www.lanouvellerepublique.fr/redaction/', 'presse_ecrite', 'regional', 3),
('Le Parisien', 'leparisien.fr', 'https://www.leparisien.fr/equipe-redactionnelle/', 'presse_ecrite', 'regional', 2),
('Courrier Picard', 'courrier-picard.fr', 'https://www.courrier-picard.fr/redaction/', 'presse_ecrite', 'regional', 4),
('L''Union', 'lunion.fr', 'https://www.lunion.fr/redaction/', 'presse_ecrite', 'regional', 4),
('Paris Normandie', 'paris-normandie.fr', 'https://www.paris-normandie.fr/redaction/', 'presse_ecrite', 'regional', 4),
('Le Berry Républicain', 'leberry.fr', 'https://www.leberry.fr/redaction/', 'presse_ecrite', 'regional', 4),
('La Charente Libre', 'charentelibre.fr', 'https://www.charentelibre.fr/redaction/', 'presse_ecrite', 'regional', 4),
('Le Populaire du Centre', 'lepopulaire.fr', 'https://www.lepopulaire.fr/redaction/', 'presse_ecrite', 'regional', 4),
('L''Indépendant', 'lindependant.fr', 'https://www.lindependant.fr/redaction/', 'presse_ecrite', 'regional', 4),

-- === MAGAZINES (priorité 3) ===
('L''Equipe', 'lequipe.fr', 'https://www.lequipe.fr/equipe-redactionnelle/', 'presse_ecrite', 'magazine', 2),
('Elle', 'elle.fr', 'https://www.elle.fr/redaction/', 'presse_ecrite', 'magazine', 3),
('Marie Claire', 'marieclaire.fr', 'https://www.marieclaire.fr/redaction/', 'presse_ecrite', 'magazine', 3),
('Femme Actuelle', 'femmeactuelle.fr', 'https://www.femmeactuelle.fr/redaction/', 'presse_ecrite', 'magazine', 3),
('Psychologies', 'psychologies.com', 'https://www.psychologies.com/auteurs/', 'presse_ecrite', 'magazine', 3),
('GEO', 'geo.fr', 'https://www.geo.fr/auteurs/', 'presse_ecrite', 'magazine', 3),
('National Geographic France', 'nationalgeographic.fr', 'https://www.nationalgeographic.fr/auteurs/', 'presse_ecrite', 'magazine', 3),
('Science & Vie', 'science-et-vie.com', 'https://www.science-et-vie.com/auteurs/', 'presse_ecrite', 'magazine', 3),
('Sciences et Avenir', 'sciencesetavenir.fr', 'https://www.sciencesetavenir.fr/auteurs/', 'presse_ecrite', 'magazine', 3),
('Historia', 'historia.fr', 'https://www.historia.fr/auteurs/', 'presse_ecrite', 'magazine', 4),
('L''Histoire', 'lhistoire.fr', 'https://www.lhistoire.fr/auteurs/', 'presse_ecrite', 'magazine', 4),
('Télérama', 'telerama.fr', 'https://www.telerama.fr/auteurs/', 'presse_ecrite', 'magazine', 2),
('Les Inrockuptibles', 'lesinrocks.com', 'https://www.lesinrocks.com/auteurs/', 'presse_ecrite', 'magazine', 3),
('Première', 'premiere.fr', 'https://www.premiere.fr/auteurs/', 'presse_ecrite', 'magazine', 3),
('Studio Magazine', 'studiociné.com', 'https://www.studiocine.com/equipe/', 'presse_ecrite', 'magazine', 4),
('Courrier International', 'courrierinternational.com', 'https://www.courrierinternational.com/auteurs/', 'presse_ecrite', 'magazine', 2),
('L''Obs Hebdo', 'nouvelobs.com', 'https://www.nouvelobs.com/auteurs/', 'presse_ecrite', 'magazine', 2),
('Alternatives Économiques', 'alternatives-economiques.fr', 'https://www.alternatives-economiques.fr/auteurs/', 'presse_ecrite', 'magazine', 3),
('Que Choisir', 'quechoisir.org', 'https://www.quechoisir.org/auteurs/', 'presse_ecrite', 'magazine', 3),
('60 Millions de Consommateurs', '60millions-mag.com', 'https://www.60millions-mag.com/auteurs/', 'presse_ecrite', 'magazine', 3),

-- === SANTÉ & MÉDECINE ===
('Le Quotidien du Médecin', 'lequotidiendumedecin.fr', 'https://www.lequotidiendumedecin.fr/auteurs/', 'presse_ecrite', 'specialise', 2),
('Impact Médecin', 'impactmedecin.fr', 'https://www.impactmedecin.fr/redaction/', 'presse_ecrite', 'specialise', 3),
('Le Généraliste', 'legeneraliste.fr', 'https://www.legeneraliste.fr/auteurs/', 'presse_ecrite', 'specialise', 3),
('Décision Santé', 'decisionsante.com', 'https://www.decisionsante.com/auteurs/', 'presse_ecrite', 'specialise', 3),
('TICsanté', 'ticsante.com', 'https://www.ticsante.com/auteurs/', 'web', 'specialise', 4),
('Pourquoi Docteur', 'pourquoidocteur.fr', 'https://www.pourquoidocteur.fr/auteurs/', 'web', 'specialise', 3),
('Destination Santé', 'destinationsante.com', 'https://destinationsante.com/auteurs/', 'web', 'specialise', 4),
('Top Santé', 'topsante.com', 'https://www.topsante.com/auteurs/', 'presse_ecrite', 'specialise', 3),
('Vidal', 'vidal.fr', 'https://www.vidal.fr/auteurs/', 'web', 'specialise', 3),
('Jim.fr', 'jim.fr', 'https://www.jim.fr/auteurs/', 'web', 'specialise', 3),

-- === ENVIRONNEMENT & DÉVELOPPEMENT DURABLE ===
('Actu-Environnement', 'actu-environnement.com', 'https://www.actu-environnement.com/redaction/', 'web', 'specialise', 2),
('Novethic', 'novethic.fr', 'https://www.novethic.fr/auteurs/', 'web', 'specialise', 2),
('Socialter', 'socialter.fr', 'https://www.socialter.fr/auteurs/', 'presse_ecrite', 'specialise', 3),
('Vert.eco', 'vert.eco', 'https://vert.eco/auteurs/', 'web', 'specialise', 3),
('Bon Pote', 'bonpote.com', 'https://bonpote.com/equipe/', 'blog', 'specialise', 3),
('Futura Sciences', 'futura-sciences.com', 'https://www.futura-sciences.com/auteurs/', 'web', 'specialise', 2),
('Natura Sciences', 'natura-sciences.com', 'https://www.natura-sciences.com/auteurs/', 'web', 'specialise', 3),

-- === AGRICULTURE & AGROALIMENTAIRE ===
('La France Agricole', 'lafranceagricole.fr', 'https://www.lafranceagricole.fr/redaction/', 'presse_ecrite', 'specialise', 2),
('Agra Presse', 'agrapresse.fr', 'https://www.agrapresse.fr/auteurs/', 'presse_ecrite', 'specialise', 3),
('Réussir Agri', 'reussir.fr', 'https://www.reussir.fr/auteurs/', 'presse_ecrite', 'specialise', 3),
('Le Betteravier Français', 'betteravier-francais.fr', 'https://www.betteravier-francais.fr/redaction/', 'presse_ecrite', 'specialise', 5),
('Process Alimentaire', 'processalimentaire.com', 'https://www.processalimentaire.com/auteurs/', 'web', 'specialise', 4),
('Agro Médias', 'agromedias.fr', 'https://www.agromedias.fr/auteurs/', 'web', 'specialise', 4),

-- === IMMOBILIER & CONSTRUCTION ===
('Le Moniteur', 'lemoniteur.fr', 'https://www.lemoniteur.fr/auteurs/', 'presse_ecrite', 'specialise', 2),
('Batiactu', 'batiactu.com', 'https://www.batiactu.com/auteurs/', 'web', 'specialise', 3),
('Le Journal de l''Agence', 'journaldel-agence.fr', 'https://www.journaldel-agence.fr/redaction/', 'web', 'specialise', 4),
('Business Immo', 'businessimmo.com', 'https://www.businessimmo.com/auteurs/', 'web', 'specialise', 3),
('Indicateur Bertrand', 'indicateur-bertrand.fr', 'https://www.indicateur-bertrand.fr/redaction/', 'presse_ecrite', 'specialise', 4),

-- === LUXE & MODE ===
('Le Monde du Luxe', 'lemondeduluxe.com', 'https://lemondeduluxe.com/auteurs/', 'web', 'specialise', 3),
('Vogue France', 'vogue.fr', 'https://www.vogue.fr/redaction/', 'presse_ecrite', 'specialise', 2),
('Harper''s Bazaar France', 'harpersbazaar.fr', 'https://www.harpersbazaar.fr/redaction/', 'presse_ecrite', 'specialise', 3),
('Madame Figaro', 'madame.lefigaro.fr', 'https://madame.lefigaro.fr/redaction/', 'presse_ecrite', 'specialise', 3),
('Grazia', 'grazia.fr', 'https://www.grazia.fr/redaction/', 'presse_ecrite', 'specialise', 3),
('Forbes France', 'forbes.fr', 'https://www.forbes.fr/auteurs/', 'web', 'specialise', 2),
('Business of Fashion France', 'businessoffashion.com', 'https://www.businessoffashion.com/authors/', 'web', 'specialise', 3),

-- === TOURISME & GASTRONOMIE ===
('Le Figaro Voyage', 'lefigaro.fr', 'https://voyage.lefigaro.fr/auteurs/', 'web', 'specialise', 3),
('Gault&Millau', 'gaultmillau.fr', 'https://www.gaultmillau.fr/auteurs/', 'web', 'specialise', 3),
('Le Chef Magazine', 'lechefmagazine.fr', 'https://www.lechefmagazine.fr/auteurs/', 'presse_ecrite', 'specialise', 4),
('Néorestauration', 'neorestauration.com', 'https://www.neorestauration.com/auteurs/', 'web', 'specialise', 4),

-- === SPORT ===
('RMC Sport', 'rmcsport.bfmtv.com', 'https://rmcsport.bfmtv.com/equipe/', 'tv', 'specialise', 2),
('Eurosport', 'eurosport.fr', 'https://www.eurosport.fr/journalistes/', 'tv', 'specialise', 2),
('So Foot', 'sofoot.com', 'https://www.sofoot.com/auteurs/', 'presse_ecrite', 'specialise', 3),
('France Football', 'francefootball.fr', 'https://www.francefootball.fr/auteurs/', 'presse_ecrite', 'specialise', 3),
('Vélo Magazine', 'velomag.com', 'https://www.velomag.com/auteurs/', 'presse_ecrite', 'specialise', 4),
('Tennis Magazine', 'tennisnews.fr', 'https://www.tennisnews.fr/auteurs/', 'presse_ecrite', 'specialise', 5),
('Basket USA', 'basketusa.com', 'https://www.basketusa.com/auteurs/', 'web', 'specialise', 4),

-- === JURIDIQUE & LÉGAL ===
('Dalloz Actualité', 'actu.dalloz.fr', 'https://actu.dalloz.fr/auteurs/', 'web', 'specialise', 3),
('LegalNews', 'legalnews.fr', 'https://www.legalnews.fr/auteurs/', 'web', 'specialise', 4),
('Les Affiches Parisiennes', 'affichesparisiennes.com', 'https://www.affichesparisiennes.com/redaction/', 'presse_ecrite', 'specialise', 4),
('Village Justice', 'village-justice.com', 'https://www.village-justice.com/auteurs/', 'web', 'specialise', 3),

-- === RH & MANAGEMENT ===
('HR Infos', 'hrinfos.fr', 'https://www.hrinfos.fr/auteurs/', 'web', 'specialise', 4),
('Liaisons Sociales', 'liaisons-sociales.fr', 'https://www.liaisons-sociales.fr/auteurs/', 'presse_ecrite', 'specialise', 3),
('L''Entreprise', 'lentreprise.lexpress.fr', 'https://lentreprise.lexpress.fr/auteurs/', 'web', 'specialise', 3),
('Management', 'management.fr', 'https://www.management.fr/auteurs/', 'web', 'specialise', 3),
('Action Commerciale', 'actionco.fr', 'https://www.actionco.fr/auteurs/', 'web', 'specialise', 4),

-- === ÉNERGIE ===
('EnerGeek', 'energeek.fr', 'https://energeek.fr/auteurs/', 'web', 'specialise', 3),
('Connaissance des Énergies', 'connaissancedesenergies.org', 'https://www.connaissancedesenergies.org/auteurs/', 'web', 'specialise', 3),
('L''Énergie en Questions', 'lenergieenquestions.fr', 'https://www.lenergieenquestions.fr/auteurs/', 'web', 'specialise', 4),
('Transitions & Energies', 'transitionsenergies.com', 'https://www.transitionsenergies.com/auteurs/', 'web', 'specialise', 3),
('Gaz & Électricité', 'gaz-et-electricite.fr', 'https://www.gaz-et-electricite.fr/auteurs/', 'web', 'specialise', 5),

-- === MÉDIAS & COMMUNICATION ===
('CB News', 'cbnews.fr', 'https://www.cbnews.fr/auteurs/', 'web', 'specialise', 3),
('Stratégies', 'strategies.fr', 'https://www.strategies.fr/auteurs/', 'presse_ecrite', 'specialise', 2),
('Influencia', 'influencia.net', 'https://www.influencia.net/auteurs/', 'web', 'specialise', 3),
('E-marketing', 'e-marketing.fr', 'https://www.e-marketing.fr/auteurs/', 'web', 'specialise', 3),
('Media Aces', 'media-aces.fr', 'https://media-aces.fr/auteurs/', 'web', 'specialise', 4),
('Puremedias', 'puremedias.com', 'https://www.puremedias.com/auteurs/', 'web', 'specialise', 3),

-- === CULTURE & ARTS ===
('Télérama Art & Scènes', 'telerama.fr', 'https://www.telerama.fr/scenes/auteurs/', 'presse_ecrite', 'specialise', 3),
('Cahiers du Cinéma', 'cahiersducinema.com', 'https://www.cahiersducinema.com/auteurs/', 'presse_ecrite', 'specialise', 3),
('Chronic''art', 'chronicart.com', 'https://www.chronicart.com/auteurs/', 'web', 'specialise', 4),
('La Croix - Culture', 'la-croix.com', 'https://www.la-croix.com/culture/', 'presse_ecrite', 'specialise', 3),
('Têtu', 'tetu.com', 'https://tetu.com/auteurs/', 'web', 'specialise', 3),
('Causeur', 'causeur.fr', 'https://www.causeur.fr/auteurs/', 'web', 'specialise', 4),

-- === STARTUP & ENTREPRENEURIAT ===
('BFM Business Tech', 'bfmtv.com', 'https://www.bfmtv.com/tech/', 'tv', 'tech', 3),
('Challenges Start', 'challenges.fr', 'https://www.challenges.fr/start-up/', 'presse_ecrite', 'specialise', 3),
('Frenchweb Daily', 'frenchweb.fr', 'https://www.frenchweb.fr/auteurs/', 'web', 'specialise', 2),
('The Recursive', 'therecursive.com', 'https://therecursive.com/authors/', 'web', 'tech', 4),
('Paperjam', 'paperjam.lu', 'https://paperjam.lu/auteurs/', 'web', 'specialise', 4),

-- === DOM-TOM & FRANCE OUTRE-MER ===
('Martinique la 1ère', 'la1ere.francetvinfo.fr', 'https://la1ere.francetvinfo.fr/martinique/equipe/', 'tv', 'regional', 5),
('France-Antilles', 'martinique.franceantilles.fr', 'https://www.martinique.franceantilles.fr/redaction/', 'presse_ecrite', 'regional', 5),
('Journal de La Réunion', 'clicanoo.com', 'https://www.clicanoo.com/redaction/', 'presse_ecrite', 'regional', 5)

ON CONFLICT (team_page_url) DO NOTHING;

-- ============================================
-- PART 7 : Trigger updated_at pour scraping_sources
-- ============================================

CREATE OR REPLACE FUNCTION update_scraping_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scraping_sources_updated_at
  BEFORE UPDATE ON scraping_sources
  FOR EACH ROW EXECUTE FUNCTION update_scraping_sources_updated_at();
