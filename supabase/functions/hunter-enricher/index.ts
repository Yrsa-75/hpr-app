// ============================================
// HPR — hunter-enricher Edge Function v1
// Enrichit en masse les journalistes sans email via Hunter.io
// PRIORITÉ ABSOLUE : sans email valide, la plateforme ne sert à rien
//
// Flow :
//   1. Vérifie les crédits Hunter restants
//   2. Récupère un batch de journalistes sans email (pas encore tentés)
//   3. Pour chaque : résout le domaine media_outlet → domain.tld
//   4. Appelle Hunter email-finder API
//   5. Si trouvé (confiance ≥ 70%) : sauvegarde + tag via-hunter
//   6. Marque hunter-tried dans tous les cas (évite les boucles)
//
// Cron : toutes les 2h via pg_cron
// Budget : s'arrête si < 50 crédits restants
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY')!;

const BATCH_SIZE = 30;           // journalistes par run (limite timeout 150s)
const MIN_CONFIDENCE = 70;       // confiance min Hunter pour accepter l'email
const CREDITS_SAFETY_FLOOR = 50; // arrêt si crédits restants < 50
const DELAY_MS = 250;            // 250ms entre appels Hunter (max 4 req/s)
const HUNTER_BASE = 'https://api.hunter.io/v2';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ============================================
// Mapping media_outlet → domaine email
// Construit à partir des sources connues + variantes courantes
// ============================================
const DOMAIN_MAP: Record<string, string> = {
  // Presse nationale
  'le monde': 'lemonde.fr',
  'le figaro': 'lefigaro.fr',
  'libération': 'liberation.fr',
  'liberation': 'liberation.fr',
  'les échos': 'lesechos.fr',
  'les echos': 'lesechos.fr',
  'le parisien': 'leparisien.fr',
  "l'express": 'lexpress.fr',
  'l\'express': 'lexpress.fr',
  'le point': 'lepoint.fr',
  "l'obs": 'nouvelobs.com',
  'l\'obs': 'nouvelobs.com',
  'le nouvel obs': 'nouvelobs.com',
  'marianne': 'marianne.net',
  'mediapart': 'mediapart.fr',
  'la croix': 'la-croix.com',
  "l'humanité": 'humanite.fr',
  'l\'humanité': 'humanite.fr',
  'challenges': 'challenges.fr',
  'capital': 'capital.fr',
  'le huffpost': 'huffingtonpost.fr',
  'courrier international': 'courrierinternational.com',
  'paris match': 'parismatch.com',
  'la tribune': 'latribune.fr',
  "l'opinion": 'lopinion.fr',
  "l'agefi": 'agefi.fr',
  '20 minutes': '20minutes.fr',
  // TV / Radio
  'france info': 'francetvinfo.fr',
  'france inter': 'radiofrance.fr',
  'france culture': 'radiofrance.fr',
  'rfi': 'rfi.fr',
  'rmc': 'bfmtv.com',
  'bfm tv': 'bfmtv.com',
  'bfm business': 'bfmtv.com',
  'europe 1': 'europe1.fr',
  'rtl': 'rtl.fr',
  'lci': 'tf1info.fr',
  'cnews': 'cnews.fr',
  // Tech & Numérique
  '01net': '01net.com',
  'silicon.fr': 'silicon.fr',
  'le monde informatique': 'lemondeinformatique.fr',
  'zdnet france': 'zdnet.fr',
  'maddyness': 'maddyness.com',
  'frenchweb': 'frenchweb.fr',
  'numerama': 'numerama.com',
  'frandroid': 'frandroid.com',
  'nextinpact': 'nextinpact.com',
  'les numériques': 'lesnumeriques.com',
  'clubic': 'clubic.com',
  'journal du net': 'journaldunet.com',
  "l'adn": 'ladn.eu',
  'siècle digital': 'siecledigital.fr',
  'futura sciences': 'futura-sciences.com',
  // Sciences / Environnement
  'science & vie': 'science-et-vie.com',
  'sciences et avenir': 'sciencesetavenir.fr',
  'geo': 'geo.fr',
  'vert.eco': 'vert.eco',
  'reporterre': 'reporterre.net',
  'alternatives économiques': 'alternatives-economiques.fr',
  'actu-environnement': 'actu-environnement.com',
  'novethic': 'novethic.fr',
  'socialter': 'socialter.fr',
  // Culture & Lifestyle
  'les inrockuptibles': 'lesinrocks.com',
  'vogue france': 'vogue.fr',
  'télérama': 'telerama.fr',
  'telerama': 'telerama.fr',
  // Presse régionale
  'ouest-france': 'ouest-france.fr',
  'la voix du nord': 'lavoixdunord.fr',
  'sud ouest': 'sudouest.fr',
  'midi libre': 'midilibre.fr',
  'la dépêche du midi': 'ladepeche.fr',
  'la montagne': 'lamontagne.fr',
  'nice-matin': 'nicematin.com',
  "l'est républicain": 'estrepublicain.fr',
  'le progrès': 'leprogres.fr',
  'le dauphiné libéré': 'ledauphine.com',
  'le télégramme': 'letelegramme.fr',
  'le nouvelle republique': 'lanouvellerepublique.fr',
  'la nouvelle république': 'lanouvellerepublique.fr',
  // Sport
  "l'équipe": 'lequipe.fr',
  'so foot': 'sofoot.com',
  'eurosport': 'eurosport.fr',
  // Sectoriels
  'stratégies': 'strategies.fr',
  'influencia': 'influencia.net',
  'puremedias': 'puremedias.com',
  'cb news': 'cb-news.fr',
  'le moniteur': 'lemoniteur.fr',
  "l'usine nouvelle": 'usinenouvelle.com',
  'batiactu': 'batiactu.com',
  'village justice': 'village-justice.com',
  'liaisons sociales': 'liaisons-sociales.fr',
  'la france agricole': 'lafranceagricole.fr',
  'le quotidien du médecin': 'lequotidiendumedecin.fr',
  'management': 'management.fr',
  'forbes france': 'forbes.fr',
  'slate.fr': 'slate.fr',
  'usbek & rica': 'usbek-rica.fr',
  'usbeketrica': 'usbek-rica.fr',
};

function resolveDomain(mediaOutlet: string): string | null {
  if (!mediaOutlet) return null;
  const key = mediaOutlet
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents pour la recherche
    .trim();

  // 1. Correspondance exacte (avec normalisation accents)
  for (const [name, domain] of Object.entries(DOMAIN_MAP)) {
    const normName = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (normName === key) return domain;
  }

  // 2. Correspondance partielle
  for (const [name, domain] of Object.entries(DOMAIN_MAP)) {
    const normName = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (key.includes(normName) || normName.includes(key)) return domain;
  }

  return null;
}

// ============================================
// Hunter.io API calls
// ============================================
async function getCreditsRemaining(): Promise<number> {
  const res = await fetch(`${HUNTER_BASE}/account?api_key=${HUNTER_API_KEY}`);
  if (!res.ok) throw new Error(`Hunter account error: ${res.status}`);
  const data = await res.json();
  return data.data?.requests?.searches?.available ?? 0;
}

interface HunterResult {
  email: string | null;
  confidence: number;
}

async function hunterEmailFinder(
  firstName: string,
  lastName: string,
  domain: string | null,
  company: string
): Promise<HunterResult> {
  const params = new URLSearchParams({
    first_name: firstName,
    last_name: lastName,
    api_key: HUNTER_API_KEY,
  });

  // domain prioritaire, sinon company (Hunter résout lui-même)
  if (domain) {
    params.set('domain', domain);
  } else {
    params.set('company', company);
  }

  const res = await fetch(`${HUNTER_BASE}/email-finder?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hunter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    email: data.data?.email ?? null,
    confidence: data.data?.score ?? 0,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================
// Main
// ============================================
const CRON_SECRET = 'hpr-cron-runner-xK9mP2026';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stats = {
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0,
    creditsUsed: 0,
    creditsRemaining: 0,
  };

  try {
    if (!HUNTER_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'HUNTER_API_KEY non configuré' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérification des crédits
    const credits = await getCreditsRemaining();
    stats.creditsRemaining = credits;
    console.log(`[hunter] Crédits disponibles : ${credits}`);

    if (credits <= CREDITS_SAFETY_FLOOR) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Crédits insuffisants : ${credits} restants (seuil : ${CREDITS_SAFETY_FLOOR})`,
          stats,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Journalistes à enrichir :
    // - email NULL
    // - media_outlet connu
    // - pas encore tentés (pas de tag hunter-tried)
    // - pas désabonnés
    // Priorité : journalistes personnels d'abord, puis pool global
    const { data: journalists, error } = await supabase
      .from('journalists')
      .select('id, first_name, last_name, media_outlet, tags')
      .is('email', null)
      .not('media_outlet', 'is', null)
      .not('tags', 'cs', '{"hunter-tried"}')
      .not('is_opted_out', 'eq', true)
      .order('organization_id', { ascending: false, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (error) throw error;

    if (!journalists || journalists.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Aucun journaliste à enrichir pour le moment',
          stats,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[hunter] ${journalists.length} journalistes à traiter`);

    for (const j of journalists) {
      // Sécurité budget : arrêt si crédits proches du plancher
      if (stats.creditsRemaining - stats.creditsUsed <= CREDITS_SAFETY_FLOOR) {
        console.log('[hunter] Seuil de sécurité atteint, arrêt du batch');
        break;
      }

      stats.processed++;
      const domain = resolveDomain(j.media_outlet ?? '');
      const currentTags: string[] = j.tags ?? [];

      try {
        await sleep(DELAY_MS);

        const result = await hunterEmailFinder(
          j.first_name,
          j.last_name,
          domain,
          j.media_outlet ?? ''
        );

        const newTags = [
          ...currentTags.filter((t) => t !== 'hunter-tried' && t !== 'via-hunter' && t !== 'validate'),
          'hunter-tried',
        ];

        if (result.email && result.confidence >= MIN_CONFIDENCE) {
          newTags.push('via-hunter');
          newTags.push('validate');
          stats.found++;
          stats.creditsUsed++;

          await supabase
            .from('journalists')
            .update({
              email: result.email.toLowerCase().trim(),
              tags: newTags,
              updated_at: new Date().toISOString(),
            })
            .eq('id', j.id);

          console.log(
            `[hunter] ✓ ${j.first_name} ${j.last_name} (${j.media_outlet}) → ${result.email} (${result.confidence}%)`
          );
        } else {
          stats.notFound++;
          await supabase
            .from('journalists')
            .update({ tags: newTags, updated_at: new Date().toISOString() })
            .eq('id', j.id);

          console.log(
            `[hunter] ✗ ${j.first_name} ${j.last_name} (${j.media_outlet}) — ${result.email ? `confiance trop faible: ${result.confidence}%` : 'introuvable'}`
          );
        }
      } catch (err) {
        stats.errors++;
        console.error(`[hunter] Erreur ${j.first_name} ${j.last_name}: ${err}`);
        // Marquer quand même hunter-tried pour éviter de bloquer sur cette entrée
        const newTags = [
          ...currentTags.filter((t) => t !== 'hunter-tried'),
          'hunter-tried',
        ];
        await supabase
          .from('journalists')
          .update({ tags: newTags, updated_at: new Date().toISOString() })
          .eq('id', j.id);
      }
    }

    stats.creditsRemaining = stats.creditsRemaining - stats.creditsUsed;

    const msg = `${stats.found} emails trouvés / ${stats.processed} traités (${stats.creditsUsed} crédits consommés, ${stats.creditsRemaining} restants)`;
    console.log(`[hunter] Terminé : ${msg}`);

    return new Response(
      JSON.stringify({ success: true, message: msg, stats }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[hunter] Erreur globale:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err), stats }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
