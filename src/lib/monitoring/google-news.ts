import { createServiceClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

interface RssItem {
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string | null;
  excerpt: string;
}

function parseGoogleNewsRss(xml: string): RssItem[] {
  const items: RssItem[] = [];

  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const content = match[1];

    const title = content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? content.match(/<title>(.*?)<\/title>/)?.[1]
      ?? '';

    const link = content.match(/<link>(.*?)<\/link>/)?.[1]
      ?? content.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
      ?? '';

    const source = content.match(/<source[^>]*>(.*?)<\/source>/)?.[1]
      ?? content.match(/<source>(.*?)<\/source>/)?.[1]
      ?? '';

    const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? null;

    const description = content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
      ?? content.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?? '';

    // Strip HTML tags from description
    const excerpt = description.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 500);

    if (!title || !link || link.startsWith('http') === false) continue;

    items.push({
      title: title.trim(),
      url: link.trim(),
      sourceName: source.trim() || new URL(link).hostname.replace('www.', ''),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
      excerpt,
    });
  }

  return items;
}

async function fetchGoogleNewsRss(query: string): Promise<RssItem[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=fr&gl=FR&ceid=FR:fr`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HPR-Monitor/1.0)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseGoogleNewsRss(xml);
  } catch {
    return [];
  }
}

async function analyzeRelevance(
  article: RssItem,
  campaignContext: string,
  clientName: string
): Promise<{ relevant: boolean; sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'; summary: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Tu es un expert en relations presse. Analyse si cet article est une retombée presse pertinente.

**Client :** ${clientName}
**Contexte campagne :** ${campaignContext}

**Article :**
Titre : ${article.title}
Source : ${article.sourceName}
Extrait : ${article.excerpt || '(pas d\'extrait)'}

Réponds UNIQUEMENT avec un JSON valide (sans markdown) :
{"relevant":true|false,"sentiment":"positive|neutral|negative|mixed","summary":"<résumé en 1 phrase si pertinent, sinon vide>"}

L'article est pertinent s'il mentionne le client ou la campagne dans un contexte éditorial (pas une pub).`,
      }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Runs Google News RSS monitoring for all active campaigns.
 * Called on clippings page load.
 */
export async function monitorGoogleNews(): Promise<{ found: number; inserted: number }> {
  const supabase = createServiceClient();

  // Fetch active campaigns with client info and press release titles
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id, name, keywords, client_id,
      clients(id, name),
      press_releases(title)
    `)
    .not('status', 'in', '("draft","archived")')
    .limit(20);

  if (!campaigns?.length) return { found: 0, inserted: 0 };

  // Fetch already-known URLs to avoid duplicates
  const { data: existingClippings } = await supabase
    .from('press_clippings')
    .select('url');
  const knownUrls = new Set((existingClippings ?? []).map((c) => c.url));

  let totalFound = 0;
  let totalInserted = 0;

  for (const campaign of campaigns) {
    const client = campaign.clients as unknown as { id: string; name: string } | null;
    if (!client) continue;

    // Build search query from keywords + client name + campaign name
    const keywords: string[] = campaign.keywords ?? [];
    const pressReleaseTitle = (campaign.press_releases as unknown as { title: string }[])?.[0]?.title ?? '';

    const queryTerms = [
      client.name,
      ...(keywords.length > 0 ? keywords : [campaign.name]),
    ].filter(Boolean);

    const query = queryTerms.slice(0, 3).join(' ');
    const campaignContext = pressReleaseTitle || campaign.name;

    const items = await fetchGoogleNewsRss(query);
    totalFound += items.length;

    for (const item of items) {
      if (knownUrls.has(item.url)) continue;
      knownUrls.add(item.url);

      const analysis = await analyzeRelevance(item, campaignContext, client.name);
      if (!analysis?.relevant) continue;

      await supabase.from('press_clippings').insert({
        campaign_id: campaign.id,
        client_id: client.id,
        title: item.title,
        url: item.url,
        source_name: item.sourceName,
        source_type: 'web',
        published_at: item.publishedAt,
        excerpt: item.excerpt || null,
        sentiment: analysis.sentiment,
        detection_method: 'google_news',
        is_verified: false,
        ai_summary: analysis.summary || null,
      });

      totalInserted++;
    }
  }

  return { found: totalFound, inserted: totalInserted };
}
