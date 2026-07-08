-- ============================================
-- HPR — Migration 010
-- Patterns d'emails par domaine média
-- Permet de générer des emails candidats depuis prénom+nom+domaine
-- Format : {first}.{last}@domaine.fr | {f}{last}@domaine.fr | etc.
-- ============================================

ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS email_pattern TEXT;

-- ============================================
-- Patterns connus pour les médias français majeurs
-- Format {first} = prénom normalisé (sans accents, minuscules)
--        {last}  = nom normalisé
--        {f}     = première lettre du prénom
-- ============================================

UPDATE scraping_sources SET email_pattern = '{first}.{last}@lemonde.fr'       WHERE media_domain ILIKE '%lemonde.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lefigaro.fr'      WHERE media_domain ILIKE '%lefigaro.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@liberation.fr'    WHERE media_domain ILIKE '%liberation.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lexpress.fr'      WHERE media_domain ILIKE '%lexpress.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lepoint.fr'       WHERE media_domain ILIKE '%lepoint.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@leparisien.fr'    WHERE media_domain ILIKE '%leparisien.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@20minutes.fr'     WHERE media_domain ILIKE '%20minutes.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@bfmtv.com'        WHERE media_domain ILIKE '%bfmtv.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@europe1.fr'       WHERE media_domain ILIKE '%europe1.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@rtl.fr'           WHERE media_domain ILIKE '%rtl.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@francetvinfo.fr'  WHERE media_domain ILIKE '%francetvinfo.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@francetv.fr'      WHERE media_domain ILIKE '%francetv.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@franceinter.fr'   WHERE media_domain ILIKE '%franceinter.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@radiofrance.fr'   WHERE media_domain ILIKE '%radiofrance.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lci.fr'           WHERE media_domain ILIKE '%lci.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@cnews.fr'         WHERE media_domain ILIKE '%cnews.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@itele.fr'         WHERE media_domain ILIKE '%itele.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@nouvelobs.com'    WHERE media_domain ILIKE '%nouvelobs.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@marianne.net'     WHERE media_domain ILIKE '%marianne.net%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@challenges.fr'    WHERE media_domain ILIKE '%challenges.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@capital.fr'       WHERE media_domain ILIKE '%capital.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@latribune.fr'     WHERE media_domain ILIKE '%latribune.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lesechos.fr'      WHERE media_domain ILIKE '%lesechos.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lefigaro.fr'      WHERE media_domain ILIKE '%lefigaro.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@ladepeche.fr'     WHERE media_domain ILIKE '%ladepeche.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@sudouest.fr'      WHERE media_domain ILIKE '%sudouest.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@ouest-france.fr'  WHERE media_domain ILIKE '%ouest-france.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lavoixdunord.fr'  WHERE media_domain ILIKE '%lavoixdunord.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@republicain-lorrain.fr' WHERE media_domain ILIKE '%republicain-lorrain.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@telerama.fr'      WHERE media_domain ILIKE '%telerama.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@slate.fr'         WHERE media_domain ILIKE '%slate.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@mediapart.fr'     WHERE media_domain ILIKE '%mediapart.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@arretsurimages.net' WHERE media_domain ILIKE '%arretsurimages.net%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@courrier-picard.fr' WHERE media_domain ILIKE '%courrier-picard.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@humanite.fr'      WHERE media_domain ILIKE '%humanite.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lacroix.com'      WHERE media_domain ILIKE '%lacroix.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@valeurs-actuelles.com' WHERE media_domain ILIKE '%valeurs-actuelles.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@numerama.com'     WHERE media_domain ILIKE '%numerama.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@frandroid.com'    WHERE media_domain ILIKE '%frandroid.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@01net.com'        WHERE media_domain ILIKE '%01net.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@clubic.com'       WHERE media_domain ILIKE '%clubic.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@lesnumeriques.com' WHERE media_domain ILIKE '%lesnumeriques.com%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@huffingtonpost.fr' WHERE media_domain ILIKE '%huffingtonpost.fr%';
UPDATE scraping_sources SET email_pattern = '{first}.{last}@courrierinternational.com' WHERE media_domain ILIKE '%courrierinternational.com%';
