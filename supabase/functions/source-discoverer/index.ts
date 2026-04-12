// ============================================
// HPR — source-discoverer Edge Function v1
// Alimente en continu la base journalistes avec de nouvelles sources
//
// Deux modes :
//   fix      — Répare les sources cassées (erreurs 404/403)
//              Teste des patterns d'URL alternatifs + demande à Claude
//   discover — Découvre de nouvelles sources de journalistes
//              Claude génère une liste de médias + feeds non encore connus
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
const FIX_BATCH = 8;       // sources à réparer par run
const DISCOVER_BATCH = 25; // nouvelles sources à générer par run
const FETCH_TIMEOUT_MS = 8000;

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
  const prompt = `Tu es un expert des médias français et de leurs flux RSS.

Le média "${source.media_name}" (domaine : ${source.media_domain}) a une URL cassée : ${source.team_page_url}
Erreur : ${source.error_message ?? '404'}

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

async function discoverNewSources(existingDomains: string[]): Promise<NewSource[]> {
  const knownList = existingDomains.slice(0, 80).join(', ');

  const prompt = `Tu es un expert des médias français et de leurs sources numériques.

Je gère déjà ces domaines de médias français : ${knownList}

Génère exactement ${DISCOVER_BATCH} médias français que je ne liste PAS encore, priorité aux :
- Médias spécialisés (santé, droit, immobilier, RH, marketing, startups, environnement, culture)
- Médias régionaux solides
- Pure players digitaux sérieux
- Agences de presse (AFP, etc.)

Pour chaque, UNIQUEMENT si tu es certain de l'URL :
- media_name : nom du média
- media_domain : domaine (ex: lemonde.fr)
- team_page_url : URL de la page équipe/journalistes/auteurs
- feed_url : URL du flux RSS/Atom (null si tu n'es pas sûr)
- media_type : presse_ecrite | web | radio | tv | podcast | blog
- category : tech | economie | politique | culture | science | sport | sante | droit | immobilier | rh | environnement | general | regional
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
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { mode?: string } = {};
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

      for (const source of failedSources ?? []) {
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

      const suggestions = await discoverNewSources(existingDomains);
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
          message: `Discover terminé : ${stats.inserted} nouvelles sources ajoutées (${stats.discovered} suggérées, ${stats.tested} testées)`,
          stats,
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
