// ============================================
// HPR — scraper-worker Edge Function v7
// Scraping autonome des médias français
// Sources : HTML, RSS, Wikipedia, auteurs paginés, Twitter
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const TWITTER_BEARER_TOKEN = Deno.env.get('TWITTER_BEARER_TOKEN') ?? '';

// Claude Haiku : le moins cher, suffisant pour l'extraction structurée
// claude-haiku-4-5-20251001 : $0.80/M input, $4/M output
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const USD_TO_EUR = 0.92;
const COST_INPUT_PER_M = 0.80;
const COST_OUTPUT_PER_M = 4.00;
const SOURCES_PER_RUN = 3;
const MAX_HTML_CHARS = 20_000;
const MAX_NAME_LENGTH = 80;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ============================================
// Types
// ============================================
interface JournalistExtracted {
  first_name: string;
  last_name: string;
  email: string | null;
  role: string | null;
  beat: string[] | null;
  twitter_handle: string | null;
  linkedin_url: string | null;
  phone: string | null;
}

interface ScrapingSource {
  id: string;
  media_name: string;
  media_domain: string;
  team_page_url: string;
  feed_url: string | null;
  media_type: string | null;
  category: string | null;
  source_type: string;
  source_params: Record<string, unknown>;
  email_pattern: string | null;
}

interface ExtractionResult {
  journalists: JournalistExtracted[];
  inputTokens: number;
  outputTokens: number;
  hasMore: boolean;
  updatedParams?: Record<string, unknown>;
}

// ============================================
// Budget
// ============================================
async function checkBudget(): Promise<{ exceeded: boolean; current: number; limit: number }> {
  const month = new Date().toISOString().slice(0, 7);
  await supabase
    .from('scraping_budget_tracking')
    .upsert({ month }, { onConflict: 'month', ignoreDuplicates: true });

  const { data } = await supabase
    .from('scraping_budget_tracking')
    .select('estimated_cost_eur, budget_limit_eur')
    .eq('month', month)
    .single();

  const current = data?.estimated_cost_eur ?? 0;
  const limit = data?.budget_limit_eur ?? 200;
  return { exceeded: current >= limit, current, limit };
}

async function trackApiCost(inputTokens: number, outputTokens: number): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  const costUsd =
    (inputTokens / 1_000_000) * COST_INPUT_PER_M +
    (outputTokens / 1_000_000) * COST_OUTPUT_PER_M;
  const costEur = costUsd * USD_TO_EUR;
  await supabase.rpc('increment_scraping_budget', {
    p_month: month,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_cost_eur: costEur,
  });
}

// ============================================
// Sources
// ============================================
async function getNextSources(limit: number): Promise<ScrapingSource[]> {
  const { data } = await supabase
    .from('scraping_sources')
    .select('id, media_name, media_domain, team_page_url, feed_url, media_type, category, source_type, source_params, email_pattern')
    .eq('status', 'pending')
    .lte('next_scrape_at', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  return ((data ?? []) as ScrapingSource[]).map((s) => ({
    ...s,
    source_type: s.source_type ?? 'html',
    source_params: (s.source_params ?? {}) as Record<string, unknown>,
  }));
}

async function markInProgress(sourceId: string): Promise<void> {
  await supabase
    .from('scraping_sources')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', sourceId);
}

async function markDone(sourceId: string, count: number): Promise<void> {
  const nextScrape = new Date();
  nextScrape.setDate(nextScrape.getDate() + 30);
  await supabase
    .from('scraping_sources')
    .update({
      status: 'done',
      last_scraped_at: new Date().toISOString(),
      next_scrape_at: nextScrape.toISOString(),
      journalist_count_found: count,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId);
  await supabase.rpc('increment_scrape_count', { p_source_id: sourceId });
}

async function markPendingWithProgress(
  sourceId: string,
  count: number,
  updatedParams: Record<string, unknown>
): Promise<void> {
  // Source paginée : remettre en pending pour continuer au prochain run
  await supabase
    .from('scraping_sources')
    .update({
      status: 'pending',
      last_scraped_at: new Date().toISOString(),
      next_scrape_at: new Date().toISOString(), // immédiatement disponible
      journalist_count_found: count,
      source_params: updatedParams,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId);
}

async function markError(sourceId: string, error: string): Promise<void> {
  const nextScrape = new Date();
  nextScrape.setDate(nextScrape.getDate() + 7);
  await supabase
    .from('scraping_sources')
    .update({
      status: 'pending',
      last_scraped_at: new Date().toISOString(),
      next_scrape_at: nextScrape.toISOString(),
      error_message: error.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId);
}

// ============================================
// Fetch HTML
// ============================================
async function fetchPage(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HPR-Scraper/1.0; +https://hermespressroom.com/scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        ...extraHeaders,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|h[1-6]|section|article|header|footer|nav|main|aside)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================
// Claude — extraction structurée
// ============================================
async function callClaude(prompt: string): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  return {
    text: data.content?.[0]?.text ?? '{"journalists":[]}',
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

function parseJournalistsFromJson(text: string): JournalistExtracted[] {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    return ((parsed.journalists ?? []) as JournalistExtracted[]).filter((j) =>
      j.first_name &&
      j.last_name &&
      typeof j.first_name === 'string' &&
      typeof j.last_name === 'string' &&
      j.first_name.trim().length > 1 &&
      j.last_name.trim().length > 1 &&
      j.first_name.length < MAX_NAME_LENGTH &&
      j.last_name.length < MAX_NAME_LENGTH
    );
  } catch {
    return [];
  }
}

function buildExtractionPrompt(content: string, mediaName: string): string {
  return `Tu es un expert en extraction de données de médias français.

À partir du contenu ci-dessous provenant du site "${mediaName}", extrais tous les journalistes, rédacteurs, correspondants, éditorialistes, reporters et présentateurs que tu peux identifier.

RÈGLES :
- N'inclure QUE les journalistes/rédacteurs (pas le personnel administratif, marketing, IT)
- "beat" = tableau de thématiques couvertes, déduit du titre/rôle si possible
- "twitter_handle" doit commencer par "@" si présent
- "email" uniquement si explicitement présent dans le contenu
- Ignorer les noms trop courts ou manifestement invalides
- "role" = titre ou fonction (ex: "Rédacteur en chef", "Journaliste politique")

Réponds UNIQUEMENT avec un JSON valide (aucun texte avant ou après) :
{"journalists":[{"first_name":"Marie","last_name":"Dupont","email":null,"role":"Journaliste politique","beat":["Politique"],"twitter_handle":"@mariedupont","linkedin_url":null,"phone":null}]}

Si aucun journaliste trouvé : {"journalists":[]}

Contenu :
---
${content.slice(0, MAX_HTML_CHARS)}`;
}

// ============================================
// Handler HTML classique
// ============================================
async function handleHtml(source: ScrapingSource): Promise<ExtractionResult> {
  const html = await fetchPage(source.team_page_url);
  const cleaned = cleanHtml(html);
  const prompt = buildExtractionPrompt(cleaned, source.media_name);
  const { text, inputTokens, outputTokens } = await callClaude(prompt);
  const journalists = parseJournalistsFromJson(text);
  return { journalists, inputTokens, outputTokens, hasMore: false };
}

// ============================================
// Handler RSS
// ============================================
async function handleRss(source: ScrapingSource): Promise<ExtractionResult> {
  const feedUrl = source.feed_url ?? source.team_page_url;
  const xml = await fetchPage(feedUrl, { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' });

  // Extraire les auteurs du flux RSS (différents formats)
  const authorNames = new Set<string>();
  const articleContexts: string[] = [];

  // dc:creator
  const dcCreatorMatches = xml.matchAll(/<dc:creator[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/dc:creator>/gis);
  for (const match of dcCreatorMatches) {
    const name = match[1].trim();
    if (name && name.length > 2 && name.length < 80 && !name.includes('@') && !name.includes('http')) {
      authorNames.add(name);
    }
  }

  // <author> ou <author><name>
  const authorTagMatches = xml.matchAll(/<author[^>]*>(?:<name>)?(.*?)(?:<\/name>)?<\/author>/gis);
  for (const match of authorTagMatches) {
    const inner = match[1].replace(/<[^>]+>/g, '').trim();
    if (inner && inner.length > 2 && inner.length < 80 && !inner.includes('@')) {
      authorNames.add(inner);
    }
  }

  // media:credit
  const mediaCreditMatches = xml.matchAll(/<media:credit[^>]*>(.*?)<\/media:credit>/gis);
  for (const match of mediaCreditMatches) {
    const name = match[1].trim();
    if (name && name.length > 2 && name.length < 80) authorNames.add(name);
  }

  // <byline>
  const bylineMatches = xml.matchAll(/<byline[^>]*>(.*?)<\/byline>/gis);
  for (const match of bylineMatches) {
    const name = match[1].trim();
    if (name && name.length > 2 && name.length < 80) authorNames.add(name);
  }

  // Extraire le contexte des articles (titre + description) pour enrichir
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gis);
  for (const match of itemMatches) {
    const item = match[1];
    const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/is);
    const descMatch = item.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is);
    if (titleMatch) {
      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 100);
      articleContexts.push(title);
    }
    if (descMatch && articleContexts.length < 10) {
      const desc = descMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 150);
      if (desc) articleContexts.push(desc);
    }
    if (articleContexts.length >= 20) break;
  }

  if (authorNames.size === 0) {
    // Fallback : donner le XML brut nettoyé à Claude
    const cleaned = cleanHtml(xml);
    const prompt = buildExtractionPrompt(cleaned, source.media_name);
    const { text, inputTokens, outputTokens } = await callClaude(prompt);
    const journalists = parseJournalistsFromJson(text);
    return { journalists, inputTokens, outputTokens, hasMore: false };
  }

  // On a des noms — demander à Claude de les structurer
  const authorList = Array.from(authorNames).join('\n');
  const context = articleContexts.slice(0, 15).join(' | ');

  const prompt = `Tu es un expert en médias français.

Voici une liste de noms d'auteurs extraits du flux RSS de "${source.media_name}" (${source.media_domain}).
Contexte des articles publiés : ${context}

Pour chaque nom, génère une fiche journaliste structurée. Si un nom ressemble à un pseudo, une agence (AFP, Reuters, AP, etc.) ou n'est pas une personne réelle, ignore-le.

Noms à traiter :
${authorList}

Réponds UNIQUEMENT avec un JSON valide :
{"journalists":[{"first_name":"Marie","last_name":"Dupont","email":null,"role":null,"beat":[],"twitter_handle":null,"linkedin_url":null,"phone":null}]}

Si aucun nom valide : {"journalists":[]}`;

  const { text, inputTokens, outputTokens } = await callClaude(prompt);
  const journalists = parseJournalistsFromJson(text);
  return { journalists, inputTokens, outputTokens, hasMore: false };
}

// ============================================
// Handler Wikipedia Catégorie
// Fix v7 : utilisation de URL.searchParams pour l'encodage correct
// ============================================
async function handleWikipedia(source: ScrapingSource): Promise<ExtractionResult> {
  const params = source.source_params as Record<string, string>;
  const category = params.category ?? 'Journalistes_français';

  // Construction de l'URL avec URL API — gère l'encodage automatiquement
  const membersUrl = new URL('https://fr.wikipedia.org/w/api.php');
  membersUrl.searchParams.set('action', 'query');
  membersUrl.searchParams.set('list', 'categorymembers');
  membersUrl.searchParams.set('cmtitle', `Catégorie:${category}`);
  membersUrl.searchParams.set('cmlimit', '20');
  membersUrl.searchParams.set('cmtype', 'page');
  membersUrl.searchParams.set('format', 'json');
  membersUrl.searchParams.set('formatversion', '2');

  if (params.cmcontinue) {
    membersUrl.searchParams.set('cmcontinue', params.cmcontinue);
  }

  const membersText = await fetchPage(membersUrl.toString(), {
    'Accept': 'application/json',
    'User-Agent': 'HPR-Scraper/1.0 (hermespressroom.com; scraper@hermespressroom.com)',
  });

  let membersData: { query?: { categorymembers?: Array<{ pageid: number; title: string }> }; continue?: { cmcontinue?: string } };
  try {
    membersData = JSON.parse(membersText);
  } catch {
    throw new Error(`Wikipedia API response non parseable: ${membersText.slice(0, 200)}`);
  }

  const members = membersData?.query?.categorymembers ?? [];
  const cmcontinue = membersData?.continue?.cmcontinue ?? null;

  console.log(`[wikipedia] Catégorie "${category}": ${members.length} membres, cmcontinue=${cmcontinue ?? 'none'}`);

  if (members.length === 0) {
    return { journalists: [], inputTokens: 0, outputTokens: 0, hasMore: false };
  }

  // Récupérer les extraits des articles
  const titles = members.map((m) => m.title).join('|');
  const extractsUrl = new URL('https://fr.wikipedia.org/w/api.php');
  extractsUrl.searchParams.set('action', 'query');
  extractsUrl.searchParams.set('prop', 'extracts');
  extractsUrl.searchParams.set('exintro', 'true');
  extractsUrl.searchParams.set('exsentences', '5');
  extractsUrl.searchParams.set('explaintext', 'true');
  extractsUrl.searchParams.set('titles', titles);
  extractsUrl.searchParams.set('format', 'json');
  extractsUrl.searchParams.set('formatversion', '2');

  const extractsText = await fetchPage(extractsUrl.toString(), {
    'Accept': 'application/json',
    'User-Agent': 'HPR-Scraper/1.0 (hermespressroom.com; scraper@hermespressroom.com)',
  });

  let extractsData: { query?: { pages?: Array<{ title: string; extract?: string }> } };
  try {
    extractsData = JSON.parse(extractsText);
  } catch {
    extractsData = {};
  }

  const pages = extractsData?.query?.pages ?? [];
  const contentBlocks = pages
    .filter((p) => p.extract && p.extract.trim().length > 20)
    .map((p) => `=== ${p.title} ===\n${p.extract!.slice(0, 500)}`)
    .join('\n\n');

  if (!contentBlocks) {
    return { journalists: [], inputTokens: 0, outputTokens: 0, hasMore: cmcontinue !== null, updatedParams: cmcontinue ? { ...params, cmcontinue } : undefined };
  }

  const prompt = `Tu es un expert en journalisme français.

Voici des extraits Wikipedia de journalistes/personnalités médiatiques français appartenant à la catégorie "${category}". Pour chaque personne, extrais les informations disponibles.

N'inclure QUE les journalistes, rédacteurs, présentateurs, correspondants actifs en France. Exclure les personnalités politiques, sportives, etc. qui ne sont pas journalistes.

Extraits Wikipedia :
---
${contentBlocks.slice(0, MAX_HTML_CHARS)}

Réponds UNIQUEMENT avec un JSON valide :
{"journalists":[{"first_name":"Marie","last_name":"Dupont","email":null,"role":"Journaliste","beat":["Politique"],"twitter_handle":null,"linkedin_url":null,"phone":null}]}

Si aucun journaliste : {"journalists":[]}`;

  const { text, inputTokens, outputTokens } = await callClaude(prompt);
  const journalists = parseJournalistsFromJson(text);

  const updatedParams: Record<string, unknown> = { ...params };
  if (cmcontinue) {
    updatedParams.cmcontinue = cmcontinue;
  } else {
    delete updatedParams.cmcontinue;
  }

  return {
    journalists,
    inputTokens,
    outputTokens,
    hasMore: cmcontinue !== null,
    updatedParams,
  };
}

// ============================================
// Handler HTML paginé (pages /auteurs/)
// ============================================
async function handleHtmlAuthorsPaginated(source: ScrapingSource): Promise<ExtractionResult> {
  const params = source.source_params as Record<string, unknown>;
  const currentPage = (params.current_page as number) ?? 1;
  const baseUrl = (params.base_url as string) ?? source.team_page_url;

  // Construction de l'URL paginée
  let pageUrl = baseUrl;
  if (currentPage > 1) {
    // Patterns courants : ?page=N, /page/N, /auteurs/page/N
    if (baseUrl.includes('?')) {
      pageUrl = `${baseUrl}&page=${currentPage}`;
    } else {
      pageUrl = `${baseUrl.replace(/\/$/, '')}/page/${currentPage}`;
    }
  }

  const html = await fetchPage(pageUrl);
  const cleaned = cleanHtml(html);

  // Détecter si la page est vide / fin de pagination
  const hasContent = cleaned.length > 200;
  const looksEmpty =
    cleaned.length < 500 ||
    cleaned.toLowerCase().includes('page introuvable') ||
    cleaned.toLowerCase().includes('404') ||
    cleaned.toLowerCase().includes('aucun résultat');

  if (!hasContent || looksEmpty) {
    return { journalists: [], inputTokens: 0, outputTokens: 0, hasMore: false };
  }

  const prompt = buildExtractionPrompt(cleaned, source.media_name);
  const { text, inputTokens, outputTokens } = await callClaude(prompt);
  const journalists = parseJournalistsFromJson(text);

  // S'il y a des journalistes trouvés, il peut y avoir une page suivante
  // S'il n'y en a pas, on s'arrête
  const hasMore = journalists.length > 0;
  const updatedParams: Record<string, unknown> = {
    ...params,
    base_url: baseUrl,
    current_page: currentPage + 1,
  };

  return { journalists, inputTokens, outputTokens, hasMore, updatedParams };
}

// ============================================
// Handler Twitter Search
// ============================================
async function handleTwitterSearch(source: ScrapingSource): Promise<ExtractionResult> {
  if (!TWITTER_BEARER_TOKEN) {
    throw new Error('TWITTER_BEARER_TOKEN non configuré dans les secrets Edge Function');
  }

  const params = source.source_params as Record<string, unknown>;
  const query = (params.query as string) ?? `journaliste ${source.media_name} -is:retweet lang:fr`;

  const twitterUrl = new URL('https://api.twitter.com/2/users/search');
  twitterUrl.searchParams.set('query', query);
  twitterUrl.searchParams.set('max_results', '20');
  twitterUrl.searchParams.set('user.fields', 'name,username,description,location,entities,public_metrics');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let twitterData: { data?: Array<{ name: string; username: string; description?: string; location?: string }> };
  try {
    const response = await fetch(twitterUrl.toString(), {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (response.status === 429) {
      throw new Error('Twitter API rate limit dépassé, retry dans 7 jours');
    }
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Twitter API error ${response.status}: ${err.slice(0, 200)}`);
    }
    twitterData = await response.json();
  } finally {
    clearTimeout(timeout);
  }

  const users = twitterData?.data ?? [];
  if (users.length === 0) {
    return { journalists: [], inputTokens: 0, outputTokens: 0, hasMore: false };
  }

  const userDescriptions = users
    .map((u) => `@${u.username} | ${u.name} | ${u.description ?? ''} | ${u.location ?? ''}`)
    .join('\n');

  const prompt = `Tu es un expert en journalisme français.

Voici des profils Twitter de comptes potentiellement journalistes en France pour le média "${source.media_name}".
Pour chaque profil qui est CLAIREMENT un journaliste ou employé éditorial d'un média français, extrais les infos.
Ignore les comptes qui ne sont pas des journalistes individuels (marques, politiques, etc.).

Profils :
${userDescriptions}

Réponds UNIQUEMENT avec un JSON valide :
{"journalists":[{"first_name":"Marie","last_name":"Dupont","email":null,"role":null,"beat":[],"twitter_handle":"@mariedupont","linkedin_url":null,"phone":null}]}

Si aucun journaliste valide : {"journalists":[]}`;

  const { text, inputTokens, outputTokens } = await callClaude(prompt);
  const journalists = parseJournalistsFromJson(text);
  return { journalists, inputTokens, outputTokens, hasMore: false };
}

// ============================================
// Dispatcher principal
// ============================================
async function extractFromSource(source: ScrapingSource): Promise<ExtractionResult> {
  switch (source.source_type) {
    case 'rss':
      return handleRss(source);
    case 'wikipedia_category':
      return handleWikipedia(source);
    case 'html_authors_paginated':
      return handleHtmlAuthorsPaginated(source);
    case 'twitter_search':
      return handleTwitterSearch(source);
    default:
      return handleHtml(source);
  }
}

// ============================================
// Génération d'email depuis un pattern
// Ex: '{first}.{last}@lemonde.fr' + 'Marie-Claire' + 'Dupont'
//   → 'marie-claire.dupont@lemonde.fr'
// ============================================
function normalizeNamePart(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function applyEmailPattern(pattern: string, firstName: string, lastName: string): string | null {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (!first || !last) return null;
  return pattern
    .replace('{first}', first)
    .replace('{last}', last)
    .replace('{f}', first.charAt(0));
}

// Hunter.io email-finder (optionnel — nécessite HUNTER_API_KEY)
const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY') ?? '';

async function findEmailWithHunter(
  domain: string,
  firstName: string,
  lastName: string
): Promise<{ email: string; confidence: number } | null> {
  if (!HUNTER_API_KEY) return null;
  try {
    const url = new URL('https://api.hunter.io/v2/email-finder');
    url.searchParams.set('domain', domain);
    url.searchParams.set('first_name', firstName);
    url.searchParams.set('last_name', lastName);
    url.searchParams.set('api_key', HUNTER_API_KEY);
    const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const email = data?.data?.email;
    const confidence = data?.data?.score ?? 0;
    if (email && confidence >= 50) return { email, confidence };
    return null;
  } catch {
    return null;
  }
}

// ============================================
// Upsert journalistes dans le pool global
// ============================================
async function upsertGlobalJournalists(
  journalists: JournalistExtracted[],
  source: ScrapingSource
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  for (const j of journalists) {
    const firstName = j.first_name.trim();
    const lastName = j.last_name.trim();
    const beat = (j.beat ?? []).filter((b) => b && b.length < 100).slice(0, 10);
    const twitterHandle = j.twitter_handle?.startsWith('@')
      ? j.twitter_handle.trim()
      : j.twitter_handle
      ? `@${j.twitter_handle.trim()}`
      : null;

    // Résolution de l'email : extrait > Hunter.io > pattern > placeholder
    let email = j.email?.trim().toLowerCase() || null;
    let emailSource: 'extracted' | 'hunter' | 'pattern' | 'none' = email ? 'extracted' : 'none';

    if (!email) {
      // 1. Essai Hunter.io (si clé configurée)
      const hunterResult = await findEmailWithHunter(source.media_domain, firstName, lastName);
      if (hunterResult) {
        email = hunterResult.email.toLowerCase();
        emailSource = 'hunter';
        console.log(`[email] Hunter: ${email} (confiance ${hunterResult.confidence}%)`);
      }
    }

    if (!email && source.email_pattern) {
      // 2. Pattern domaine
      const generated = applyEmailPattern(source.email_pattern, firstName, lastName);
      if (generated) {
        email = generated;
        emailSource = 'pattern';
        console.log(`[email] Pattern: ${email}`);
      }
    }

    // Tags enrichis selon la source de l'email
    const emailTags = emailSource === 'hunter'
      ? ['auto-source', 'via-hunter']
      : emailSource === 'pattern'
      ? ['auto-source', 'email-pattern']
      : ['auto-source'];

    // is_verified : true seulement si l'email vient de Hunter avec bonne confiance
    const isVerified = emailSource === 'hunter';

    if (email) {
      const { data: existing } = await supabase
        .from('journalists')
        .select('id, tags')
        .eq('email', email)
        .eq('is_global', true)
        .maybeSingle();

      const existingTags: string[] = existing?.tags ?? [];
      const mergedTags = Array.from(new Set([...existingTags, ...emailTags]));

      if (existing) {
        await supabase
          .from('journalists')
          .update({
            first_name: firstName,
            last_name: lastName,
            media_outlet: source.media_name,
            media_type: source.media_type,
            beat: beat.length > 0 ? beat : undefined,
            twitter_handle: twitterHandle ?? undefined,
            tags: mergedTags,
            is_verified: isVerified || undefined,
            source_url: source.team_page_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        updated++;
      } else {
        const { error } = await supabase.from('journalists').insert({
          organization_id: null,
          is_global: true,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: j.phone ?? null,
          media_outlet: source.media_name,
          media_type: source.media_type,
          beat,
          notes: j.role ? `Rôle : ${j.role}` : null,
          twitter_handle: twitterHandle,
          linkedin_url: j.linkedin_url ?? null,
          tags: emailTags,
          source_url: source.team_page_url,
          is_verified: isVerified,
          is_opted_out: false,
        });
        if (!error) added++;
      }
    } else {
      // Toujours sans email (ni Hunter ni pattern disponibles)
      // Déduplication par nom + média
      const { data: existing } = await supabase
        .from('journalists')
        .select('id, tags')
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .eq('media_outlet', source.media_name)
        .eq('is_global', true)
        .maybeSingle();

      const existingTags: string[] = existing?.tags ?? [];
      const mergedTags = Array.from(new Set([...existingTags, 'auto-source']));

      if (existing) {
        await supabase
          .from('journalists')
          .update({
            beat: beat.length > 0 ? beat : undefined,
            twitter_handle: twitterHandle ?? undefined,
            tags: mergedTags,
            source_url: source.team_page_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        updated++;
      } else {
        const { error } = await supabase.from('journalists').insert({
          organization_id: null,
          is_global: true,
          first_name: firstName,
          last_name: lastName,
          email: `noemail_${crypto.randomUUID()}@noemail.hpr`,
          phone: j.phone ?? null,
          media_outlet: source.media_name,
          media_type: source.media_type,
          beat,
          notes: j.role ? `Rôle : ${j.role}` : null,
          twitter_handle: twitterHandle,
          linkedin_url: j.linkedin_url ?? null,
          tags: ['auto-source'],
          source_url: source.team_page_url,
          is_verified: false,
          is_opted_out: false,
        });
        if (!error) added++;
      }
    }
  }

  return { added, updated };
}

// ============================================
// Logger
// ============================================
async function logScrape(
  sourceId: string,
  mediaName: string,
  status: 'success' | 'error' | 'skipped_budget' | 'skipped_empty',
  added: number,
  updated: number,
  inputTokens: number,
  outputTokens: number,
  errorMessage?: string
): Promise<void> {
  const costUsd =
    (inputTokens / 1_000_000) * COST_INPUT_PER_M +
    (outputTokens / 1_000_000) * COST_OUTPUT_PER_M;
  await supabase.from('scraping_log').insert({
    source_id: sourceId,
    media_name: mediaName,
    status,
    journalists_added: added,
    journalists_updated: updated,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_eur: costUsd * USD_TO_EUR,
    error_message: errorMessage?.slice(0, 500) ?? null,
  });
}

// ============================================
// Handler HTTP principal
// ============================================
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = {
    processed: 0,
    added: 0,
    updated: 0,
    skipped_budget: false,
    errors: [] as string[],
  };

  try {
    // 1. Vérifier le budget
    const budget = await checkBudget();
    if (budget.exceeded) {
      console.log(`[scraper] Budget atteint: €${budget.current.toFixed(2)} / €${budget.limit}`);
      results.skipped_budget = true;
      return new Response(JSON.stringify({ ...results, message: 'Budget mensuel atteint' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log(`[scraper] Budget restant: €${(budget.limit - budget.current).toFixed(2)}`);

    // 2. Sources suivantes
    const sources = await getNextSources(SOURCES_PER_RUN);
    if (sources.length === 0) {
      console.log('[scraper] Aucune source disponible');
      return new Response(JSON.stringify({ ...results, message: 'Aucune source disponible' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Traiter chaque source
    for (const source of sources) {
      console.log(`[scraper] ${source.media_name} (${source.source_type}) — ${source.team_page_url}`);
      await markInProgress(source.id);

      try {
        const { journalists, inputTokens, outputTokens, hasMore, updatedParams } =
          await extractFromSource(source);

        console.log(`[scraper] ${source.media_name}: ${journalists.length} journalistes, hasMore=${hasMore}`);

        if (inputTokens > 0 || outputTokens > 0) {
          await trackApiCost(inputTokens, outputTokens);
        }

        if (journalists.length === 0 && !hasMore) {
          await markDone(source.id, 0);
          await logScrape(source.id, source.media_name, 'skipped_empty', 0, 0, inputTokens, outputTokens);
        } else {
          const { added, updated } = journalists.length > 0
            ? await upsertGlobalJournalists(journalists, source)
            : { added: 0, updated: 0 };

          if (hasMore && updatedParams) {
            // Source paginée avec suite
            await markPendingWithProgress(source.id, journalists.length, updatedParams);
          } else {
            await markDone(source.id, journalists.length);
          }

          await logScrape(
            source.id,
            source.media_name,
            journalists.length > 0 ? 'success' : 'skipped_empty',
            added,
            updated,
            inputTokens,
            outputTokens
          );

          results.added += added;
          results.updated += updated;
        }

        results.processed++;

        // Re-vérifier le budget
        const updatedBudget = await checkBudget();
        if (updatedBudget.exceeded) {
          console.log('[scraper] Budget atteint, arrêt anticipé');
          break;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[scraper] Erreur ${source.media_name}: ${errorMsg}`);
        await markError(source.id, errorMsg);
        await logScrape(source.id, source.media_name, 'error', 0, 0, 0, 0, errorMsg);
        results.errors.push(`${source.media_name}: ${errorMsg}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[scraper] Erreur fatale:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
