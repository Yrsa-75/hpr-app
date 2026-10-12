// ============================================
// HPR — source-discoverer Edge Function v4
// Alimente en continu la base journalistes avec de nouvelles sources
//
// Deux modes :
//   fix      — Répare les sources cassées (erreurs 404/403)
//              ET les sources "placeholder" dont team_page_url est une
//              simple page d'accueil (elles scrapaient "avec succès" mais
//              n'ajoutaient jamais aucun journaliste, puis étaient parquées
//              30 jours). Teste des patterns d'URL + demande à Claude.
//   discover — Découvre de nouvelles sources de journalistes
//              Claude génère une liste de médias + feeds non encore connus
//
// v3 (brief 2026-07-09 §6f) : prise en charge des placeholders — les 53
// sources ajoutées les 06-09/07 avaient toutes une homepage en guise de
// team_page_url et n'étaient jamais candidates au mode fix
// (consecutive_failures = 0).
//
// v4 (diagnostic 2026-10-12) :
//   - discover : Claude ne recevait que les 80 premiers domaines connus
//     (sur ~240) et re-proposait des médias déjà en base → ~1 source/semaine.
//     Désormais la liste complète est envoyée, et un thème cible tourne
//     chaque jour (sport, deux-roues, tech grand public, auto, etc.) ou se
//     force via body.focus.
//   - fix : les placeholders marqués 'fix-placeholder' n'étaient JAMAIS
//     retentés. Désormais retentés après PLACEHOLDER_RETRY_DAYS jours.
//
// Cron :
//   fix      → toutes les 6h
//   discover → 1x/jour (3h du matin)
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const FIX_BATCH = 8;        // sources en erreur à réparer par run
const PLACEHOLDER_BATCH = 6; // sources "homepage placeholder" à réparer par run
const DISCOVER_BATCH = 25;  // nouvelles sources à générer par run
const FETCH_TIMEOUT_MS = 8000;
const PLACEHOLDER_RETRY_DAYS = 14; // v4 : un placeholder échoué est retenté après ce délai

// v4 : thèmes cibles du mode discover, un par jour (rotation sur le jour du mois)
interface DiscoverFocus { key: string; label: string; categories: string }
const DISCOVER_FOCUS: DiscoverFocus[] = [
  { key: 'sport', label: 'Médias sport (football, cyclisme, running, sports mécaniques, outdoor, sites et magazines spécialisés, rubriques sport des grands quotidiens)', categories: 'sport | velo | outdoor' },
  { key: 'deux-roues', label: 'Médias deux-roues : moto, scooter, vélo, VAE, mobilité urbaine, trottinette (magazines, pure players, blogs de référence)', categories: 'moto | velo | auto' },
  { key: 'tech-grand-public', label: "Médias tech grand public et high-tech : smartphones, informatique, jeux vidéo, tutoriels, guides d'achat (type commentcamarche.net, journaldugeek.com, phonandroid.com)", categories: 'tech' },
  { key: 'auto', label: 'Médias automobile et mobilité : essais, actualité, électrique, occasion', categories: 'auto' },
  { key: 'specialise', label: 'Médias spécialisés (santé, droit, immobilier, RH, marketing, startups, environnement, culture)', categories: 'sante | droit | immobilier | rh | environnement | culture | economie' },
  { key: 'regional', label: 'Médias régionaux et locaux solides (PQR, hebdos, radios et TV locales, pure players régionaux)', categories: 'regional' },
  { key: 'general', label: 'Pure players digitaux sérieux, agences de presse, magazines grand public, radios et TV nationales', categories: 'general | politique | economie | tv_radio' },
];

function pickFocus(requested?: string): DiscoverFocus {
  if (requested) {
    const found = DISCOVER_FOCUS.find((f) => f.key === requested);
    if (found) return found;
  }
  const day = new Date().getUTCDate();
  return DISCOVER_FOCUS[day % DISCOVER_FOCUS.length];
}

// Détecte une team_page_url qui n'est qu'une page d'accueil (ex: https://site.fr/)
const HOMEPAGE_RE = /^https?:\/\/[^/]+\/?$/;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ============================================
// Helpers HTTP
// ============================================
async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HPR-bot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,*/*',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function isValidFeed(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes('<rss') || text.includes('<feed') || text.includes('<channel');
  } catch {
    return false;
  }
}

async function isValidPage(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url);
    return res.ok && res.status < 400;
  } catch {
    return false;
  }
}

// ============================================
// Claude API
// ============================================
async function callClaude(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ============================================
// MODE FIX : Réparer les sources cassées
// ============================================

// Génère des variantes d'URL RSS à tester pour un domaine
function rssUrlCandidates(domain: string): string[] {
  const d = domain.replace(/^www\./, '');
  return [
    `https://www.${d}/rss.xml`,
    `https://www.${d}/feed.xml`,
    `https://www.${d}/feed`,
    `https://www.${d}/rss`,
    `https://www.${d}/rss/all`,
    `https://www.${d}/feeds/posts/default`,
    `https://www.${d}/actualites.rss`,
    `https://www.${d}/actu.rss`,
    `https://www.${d}/news.rss`,
    `https://www.${d}/flux-rss`,
    `https://www.${d}/flux`,
    `https://www.${d}/api/rss`,
    `https://${d}/rss.xml`,
    `https://${d}/feed.xml`,
    `https://${d}/feed`,
  ];
}

async function fixSource(source: {
  id: string;
  media_name: string;
  media_domain: string;
  team_page_url: string;
  error_message: string | null;
}): Promise<{ fixed: boolean; newUrl?: string; type?: string }> {
  // 1. Tester des patterns RSS standard
  const candidates = rssUrlCandidates(source.media_domain);
  for (const url of candidates) {
    if (await isValidFeed(url)) {
      console.log(`[fix] ${source.media_name} → RSS trouvé : ${url}`);
      return { fixed: true, newUrl: url, type: 'rss' };
    }
  }

  // 2. Demander à Claude l'URL correcte
  const problem = source.error_message
    ? `a une URL cassée : ${source.team_page_url}\nErreur : ${source.error_message}`
    : `n'a qu'une page d'accueil générique en guise de team_page_url : ${source.team_page_url}\nIl faut la vraie page équipe/rédaction/auteurs, ou un flux RSS.`;

  const prompt = `Tu es un expert des médias français et de leurs flux RSS.

Le média "${source.media_name}" (domaine : ${source.media_domain}) ${problem}

Réponds UNIQUEMENT avec un objet JSON valide (pas de commentaire, pas de markdown) :
{
  "feed_url": "URL complète du flux RSS ou Atom du média, ou null si inconnu",
  "team_page_url": "URL de la page équipe/auteurs du média, ou null si inconnue",
  "source_type": "rss" ou "html",
  "notes": "explication courte"
}

Si tu ne connais pas avec certitude, utilise null. Ne génère pas d'URL inventée.`;

  try {
    const response = await callClaude(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { fixed: false };

    const suggestion = JSON.parse(jsonMatch[0]);

    // Tester l'URL suggérée par Claude
    if (suggestion.feed_url) {
      if (await isValidFeed(suggestion.feed_url)) {
        console.log(`[fix] ${source.media_name} → Claude RSS : ${suggestion.feed_url}`);
        return { fixed: true, newUrl: suggestion.feed_url, type: 'rss' };
      }
    }
    if (suggestion.team_page_url) {
      if (await isValidPage(suggestion.team_page_url)) {
        console.log(`[fix] ${source.media_name} → Claude page : ${suggestion.team_page_url}`);
        return { fixed: true, newUrl: suggestion.team_page_url, type: suggestion.source_type ?? 'html' };
      }
    }
  } catch (err) {
    console.error(`[fix] Claude error pour ${source.media_name}: ${err}`);
  }

  return { fixed: false };
}

// ============================================
// MODE DISCOVER : Nouvelles sources via Claude
// ============================================

interface NewSource {
  media_name: string;
  media_domain: string;
  team_page_url: string;
  feed_url: string | null;
  media_type: string;
  category: string;
  source_type: string;
}

async function discoverNewSources(existingDomains: string[], focus: DiscoverFocus): Promise<NewSource[]> {
  // v4 : liste COMPLÈTE des domaines connus (avant : slice(0, 80) → Claude
  // re-proposait des médias déjà en base, tous filtrés ensuite).
  const knownList = existingDomains.join(', ');

  const prompt = `Tu es un expert des médias français et de leurs sources numériques.

Je gère déjà ces domaines de médias français (NE PAS les reproposer, ni leurs sous-domaines) : ${knownList}

THÈME DU JOUR : ${focus.label}.

Génère exactement ${DISCOVER_BATCH} médias français de ce thème que je ne liste PAS encore. Privilégie les médias qui ont une rédaction identifiable (signatures d'articles, page équipe) et un flux RSS public.

Pour chaque, UNIQUEMENT si tu es certain de l'URL :
- media_name : nom du média
- media_domain : domaine (ex: lemonde.fr)
- team_page_url : URL de la page équipe/journalistes/auteurs
- feed_url : URL du flux RSS/Atom (null si tu n'es pas sûr)
- media_type : presse_ecrite | web | radio | tv | podcast | blog
- category : de préférence ${focus.categories}, sinon tech | economie | politique | culture | science | sport | sante | droit | immobilier | rh | environnement | general | regional
- source_type : rss | html

Réponds UNIQUEMENT avec un tableau JSON valide (pas de markdown, pas de commentaires) :
[{"media_name":"...","media_domain":"...","team_page_url":"...","feed_url":"...","media_type":"...","category":"...","source_type":"..."}]`;

  const response = await callClaude(prompt);
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const raw: NewSource[] = JSON.parse(jsonMatch[0]);
    return raw.filter(
      (s) =>
        s.media_name &&
        s.media_domain &&
        (s.team_page_url || s.feed_url) &&
        !existingDomains.includes(s.media_domain)
    );
  } catch {
    return [];
  }
}

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

  let body: { mode?: string; focus?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body vide = mode fix par défaut
  }

  const mode = body.mode ?? 'fix';
  const stats = { mode, fixed: 0, discovered: 0, tested: 0, inserted: 0, errors: 0 };

  try {
    if (mode === 'fix') {
      // Sources en erreur (pas auto_disabled, pas encore trop nombreuses tentatives)
      const { data: failedSources } = await supabase
        .from('scraping_sources')
        .select('id, media_name, media_domain, team_page_url, error_message')
        .eq('auto_disabled', false)
        .gte('consecutive_failures', 1)
        .lte('consecutive_failures', 10)
        .lt('next_scrape_at', new Date().toISOString())
        .order('consecutive_failures', { ascending: true })
        .limit(FIX_BATCH);

      // Sources "placeholder" : team_page_url = page d'accueil, jamais aucun
      // journaliste ajouté. Elles scrapent "avec succès" (0 trouvé) puis sont
      // parquées 30 jours — le mode fix doit les rattraper.
      // v4 : un placeholder déjà tenté sans succès est retenté après
      // PLACEHOLDER_RETRY_DAYS jours (avant : jamais).
      const retryBefore = new Date(Date.now() - PLACEHOLDER_RETRY_DAYS * 86_400_000).toISOString();
      const { data: placeholderCandidates } = await supabase
        .from('scraping_sources')
        .select('id, media_name, media_domain, team_page_url, error_message, feed_url, total_journalists_added, updated_at')
        .eq('auto_disabled', false)
        .eq('consecutive_failures', 0)
        .is('feed_url', null)
        .eq('total_journalists_added', 0)
        .or(`error_message.is.null,and(error_message.like.fix-placeholder*,updated_at.lt.${retryBefore})`)
        .order('created_at', { ascending: false })
        .limit(60);

      const placeholderSources = (placeholderCandidates ?? [])
        .filter((s) => HOMEPAGE_RE.test(s.team_page_url ?? ''))
        .slice(0, PLACEHOLDER_BATCH);

      const placeholderIds = new Set(placeholderSources.map((s) => s.id));
      const toFix = [...(failedSources ?? []), ...placeholderSources];

      for (const source of toFix) {
        stats.tested++;
        try {
          const result = await fixSource(source);
          if (result.fixed && result.newUrl) {
            stats.fixed++;
            const isRss = result.type === 'rss';
            await supabase
              .from('scraping_sources')
              .update({
                ...(isRss
                  ? { feed_url: result.newUrl, source_type: 'rss' }
                  : { team_page_url: result.newUrl, source_type: result.type }),
                status: 'pending',
                consecutive_failures: 0,
                error_message: null,
                next_scrape_at: new Date().toISOString(), // relance immédiate
                updated_at: new Date().toISOString(),
              })
              .eq('id', source.id);
          } else {
            console.log(`[fix] ${source.media_name} : introuvable`);
            if (placeholderIds.has(source.id)) {
              // Marque le placeholder comme tenté pour ne pas le retenter à chaque run
              await supabase
                .from('scraping_sources')
                .update({
                  error_message: 'fix-placeholder: page équipe/RSS introuvable',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', source.id);
            }
          }
        } catch (err) {
          stats.errors++;
          console.error(`[fix] Erreur ${source.media_name}: ${err}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Fix terminé : ${stats.fixed}/${stats.tested} sources réparées`,
          stats,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'discover') {
      // Récupère les domaines déjà connus
      const { data: existing } = await supabase
        .from('scraping_sources')
        .select('media_domain');
      const existingDomains = (existing ?? []).map((s) => s.media_domain);

      console.log(`[discover] ${existingDomains.length} domaines déjà connus`);

      const focus = pickFocus(body.focus);
      console.log(`[discover] thème du jour : ${focus.key}`);

      const suggestions = await discoverNewSources(existingDomains, focus);
      console.log(`[discover] Claude a suggéré ${suggestions.length} nouvelles sources`);

      for (const s of suggestions) {
        stats.discovered++;

        // Validation : tester feed ou page
        const feedOk = s.feed_url ? await isValidFeed(s.feed_url) : false;
        const pageOk = !feedOk && s.team_page_url ? await isValidPage(s.team_page_url) : false;

        if (!feedOk && !pageOk) {
          console.log(`[discover] ✗ ${s.media_name} (${s.media_domain}) — URL inaccessible`);
          continue;
        }

        stats.tested++;

        const { error } = await supabase.from('scraping_sources').insert({
          media_name: s.media_name,
          media_domain: s.media_domain,
          team_page_url: s.team_page_url ?? s.feed_url,
          feed_url: feedOk ? s.feed_url : null,
          media_type: s.media_type ?? 'web',
          category: s.category ?? 'general',
          source_type: feedOk ? 'rss' : (s.source_type ?? 'html'),
          status: 'pending',
          priority: 2,
          next_scrape_at: new Date().toISOString(),
          consecutive_failures: 0,
        });

        if (!error) {
          stats.inserted++;
          console.log(`[discover] ✓ ${s.media_name} ajouté (${feedOk ? 'RSS' : 'HTML'})`);
        } else if (error.code === '23505') {
          console.log(`[discover] ${s.media_name} déjà présent`);
        } else {
          stats.errors++;
          console.error(`[discover] Insert error ${s.media_name}: ${error.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Discover terminé (${focus.key}) : ${stats.inserted} nouvelles sources ajoutées (${stats.discovered} suggérées, ${stats.tested} testées)`,
          stats: { ...stats, focus: focus.key },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Mode inconnu : ${mode}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[source-discoverer] Erreur globale:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err), stats }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
