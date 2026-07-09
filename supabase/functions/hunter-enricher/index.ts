// ============================================
// HPR — hunter-enricher Edge Function v4
// Enrichit en masse les journalistes sans email via Hunter.io
// PRIORITÉ ABSOLUE : sans email valide, la plateforme ne sert à rien
//
// Flow :
//   1. Vérifie les crédits Hunter restants
//   2. Récupère un batch de journalistes sans email (pas encore tentés)
//   3. Pour chaque : résout le domaine media_outlet → domain.tld
//   4. Appelle Hunter email-finder API
//   5. Si trouvé (confiance ≥ 70%) : sauvegarde + tags via-hunter + validate
//   6. Marque hunter-tried dans tous les cas (évite les boucles)
//
// v3 (session desktop) : auth CRON_SECRET en plus de la service role key
// v4 (brief 2026-07-09 §6f) :
//   - journalise CHAQUE run dans background_tasks (type 'hunter_finder'),
//     y compris les runs à vide — directive de visibilité de Julien :
//     aucun ajout silencieux, la page /improvements doit refléter la réalité
//   - DOMAIN_MAP complété : afp.com, francebleu.fr + segments cibles
//     LifeStick (vélo, moto, outdoor, santé/seniors, famille/conso, auto,
//     B2B assurance/prévention). TechCrunch France exclu (média fermé),
//     autojournal.net exclu (faux blog — le vrai domaine est autojournal.fr)
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
  'le point': 'lepoint.fr',
  "l'obs": 'nouvelobs.com',
  'le nouvel obs': 'nouvelobs.com',
  'marianne': 'marianne.net',
  'mediapart': 'mediapart.fr',
  'la croix': 'la-croix.com',
  "l'humanité": 'humanite.fr',
  'challenges': 'challenges.fr',
  'capital': 'capital.fr',
  'le huffpost': 'huffingtonpost.fr',
  'courrier international': 'courrierinternational.com',
  'paris match': 'parismatch.com',
  'la tribune': 'latribune.fr',
  "l'opinion": 'lopinion.fr',
  "l'agefi": 'agefi.fr',
  '20 minutes': '20minutes.fr',
  'the conversation': 'theconversation.com',
  'actu.fr': 'actu.fr',
  'arrêt sur images': 'arretsurimages.net',
  'causeur': 'causeur.fr',
  // Agences
  'afp': 'afp.com',
  'agence france-presse': 'afp.com',
  'agence france presse': 'afp.com',
  // TV / Radio
  'france info': 'francetvinfo.fr',
  'france inter': 'radiofrance.fr',
  'france culture': 'radiofrance.fr',
  'france bleu': 'francebleu.fr',
  'ici (france bleu)': 'francebleu.fr',
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
  'futura': 'futura-sciences.com',
  'presse-citron': 'presse-citron.net',
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
  'bastamag': 'basta.media',
  'basta!': 'basta.media',
  // Culture & Lifestyle
  'les inrockuptibles': 'lesinrocks.com',
  'vogue france': 'vogue.fr',
  'télérama': 'telerama.fr',
  'telerama': 'telerama.fr',
  'marie claire': 'marieclaire.fr',
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
  // Vélo (cœur de cible LifeStick pendant le Tour)
  'weelz': 'weelz.fr',
  'dimensions vélo': 'dimensionsvelo.com',
  'bike café': 'bike-cafe.fr',
  'vojo': 'vojomag.com',
  'matos vélo': 'matos-velo.fr',
  'citycle': 'citycle.com',
  'le cycle': 'lecycle.fr',
  'transition vélo': 'transitionvelo.com',
  'vélo 101': 'velo101.com',
  // Moto
  'moto magazine': 'motomag.com',
  'moto-net': 'moto-net.com',
  'le repaire des motards': 'lerepairedesmotards.com',
  'moto-station': 'moto-station.com',
  'moto station': 'moto-station.com',
  'mototribu': 'mototribu.com',
  'motoservices': 'motoservices.com',
  'moto revue': 'moto-revue.com',
  'motoplanete': 'motoplanete.com',
  'caradisiac': 'caradisiac.com',
  'asso scooter': 'asso-scooter.org',
  'urbaanews': 'urbaanews.com',
  // Outdoor / rando
  'sport et tourisme': 'sport-et-tourisme.fr',
  'i-trekkings': 'i-trekkings.net',
  'montagnes magazine': 'montagnes-magazine.com',
  'outdoor experts': 'outdoorexperts.fr',
  // Santé / seniors (SERENITY)
  'notre temps': 'notretemps.com',
  'pleine vie': 'pleinevie.fr',
  'silver eco': 'silvereco.fr',
  'senior actu': 'senioractu.com',
  'pourquoi docteur': 'pourquoidocteur.fr',
  'destination santé': 'destinationsante.com',
  'santé magazine': 'santemagazine.fr',
  'top santé': 'topsante.com',
  'agevillage': 'agevillage.com',
  'allodocteurs': 'allodocteurs.fr',
  'medisite': 'medisite.fr',
  // Famille / conso (COMPAGNON)
  'parents': 'parents.fr',
  'magicmaman': 'magicmaman.com',
  'enfant.com': 'enfant.com',
  'le journal des femmes': 'journaldesfemmes.fr',
  'femme actuelle': 'femmeactuelle.fr',
  '60 millions': '60millions-mag.com',
  '60 millions de consommateurs': '60millions-mag.com',
  'que choisir': 'quechoisir.org',
  // Auto
  'auto plus': 'autoplus.fr',
  "l'auto-journal": 'autojournal.fr',
  'auto journal': 'autojournal.fr',
  "l'argus": 'largus.fr',
  'turbo': 'turbo.fr',
  'automobile magazine': 'automobile-magazine.fr',
  'autonews': 'autonews.fr',
  'auto infos': 'auto-infos.fr',
  // B2B assurance / prévention (PRO)
  "l'argus de l'assurance": 'argusdelassurance.com',
  'face au risque': 'faceaurisque.com',
  'prévention btp': 'preventionbtp.fr',
  // Sectoriels
  'stratégies': 'strategies.fr',
  'influencia': 'influencia.net',
  'puremedias': 'puremedias.com',
  'cb news': 'cb-news.fr',
  'le moniteur': 'lemoniteur.fr',
  "l'usine nouvelle": 'usinenouvelle.com',
  'batiactu': 'batiactu.com',
  'village justice': 'village-justice.com',
  'actu-juridique': 'actu-juridique.fr',
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
    .replace(/[̀-ͯ]/g, '')
    .trim();

  for (const [name, domain] of Object.entries(DOMAIN_MAP)) {
    const normName = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    if (normName === key) return domain;
  }

  for (const [name, domain] of Object.entries(DOMAIN_MAP)) {
    const normName = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    if (key.includes(normName) || normName.includes(key)) return domain;
  }

  return null;
}

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

const CRON_SECRET = 'hpr-cron-runner-xK9mP2026';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Trace du run dans background_tasks (lu par la page /improvements).
  // Directive : TOUT run est journalisé, y compris à vide — aucun ajout silencieux.
  const { data: task } = await supabase
    .from('background_tasks')
    .insert({ type: 'hunter_finder', status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single();
  const taskId = task?.id;

  const stats = {
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0,
    creditsUsed: 0,
    creditsRemaining: 0,
  };

  async function closeTask(status: 'completed' | 'failed', message: string): Promise<void> {
    if (!taskId) return;
    await supabase.from('background_tasks').update({
      status,
      completed_at: new Date().toISOString(),
      found: stats.found,
      processed: stats.processed,
      details: { ...stats, message },
      error_message: status === 'failed' ? message : null,
    }).eq('id', taskId);
  }

  try {
    if (!HUNTER_API_KEY) {
      await closeTask('failed', 'HUNTER_API_KEY non configuré');
      return new Response(
        JSON.stringify({ success: false, error: 'HUNTER_API_KEY non configuré' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const credits = await getCreditsRemaining();
    stats.creditsRemaining = credits;
    console.log(`[hunter] Crédits disponibles : ${credits}`);

    if (credits <= CREDITS_SAFETY_FLOOR) {
      const msg = `Crédits insuffisants : ${credits} restants (seuil : ${CREDITS_SAFETY_FLOOR})`;
      await closeTask('completed', msg);
      return new Response(
        JSON.stringify({ success: false, message: msg, stats }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
      const msg = 'Aucun journaliste à enrichir pour le moment';
      await closeTask('completed', msg);
      return new Response(
        JSON.stringify({ success: true, message: msg, stats }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[hunter] ${journalists.length} journalistes à traiter`);

    for (const j of journalists) {
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
    await closeTask('completed', msg);

    return new Response(
      JSON.stringify({ success: true, message: msg, stats }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[hunter] Erreur globale:', err);
    await closeTask('failed', String(err));
    return new Response(
      JSON.stringify({ success: false, error: String(err), stats }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
