'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ReportSummaryResult = {
  success: boolean;
  error?: string;
  summary?: string;
};

export async function generateReportSummaryAction(campaignId: string): Promise<ReportSummaryResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { success: false, error: 'Clé API Anthropic non configurée' };

  const [{ data: campaign }, { data: sends }, { data: clippings }, { data: threads }] = await Promise.all([
    supabase.from('campaigns').select('name, total_sent, clients(name)').eq('id', campaignId).single(),
    supabase.from('email_sends').select('status').eq('campaign_id', campaignId).neq('status', 'queued'),
    supabase.from('press_clippings').select('title, source_name, sentiment, is_verified').eq('campaign_id', campaignId),
    supabase.from('email_threads').select('status, sentiment').eq('campaign_id', campaignId),
  ]);

  if (!campaign) return { success: false, error: 'Campagne introuvable' };

  const total = sends?.length ?? 0;
  const opened = sends?.filter(s => ['opened', 'clicked'].includes(s.status)).length ?? 0;
  const clicked = sends?.filter(s => s.status === 'clicked').length ?? 0;
  const bounced = sends?.filter(s => s.status === 'bounced').length ?? 0;
  const replied = threads?.length ?? 0;
  const retombees = clippings?.filter(c => c.is_verified).length ?? 0;
  const client = (campaign as any).clients?.name ?? 'le client';

  const clippingsList = clippings?.filter(c => c.is_verified).map(c => `- ${c.title} (${c.source_name})`).join('\n') ?? '';

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Tu es un expert en relations presse. Rédige un résumé exécutif concis (3-4 paragraphes) pour ce rapport de campagne RP.

**Campagne :** ${campaign.name}
**Client :** ${client}

**Statistiques :**
- Emails envoyés : ${total}
- Taux d'ouverture : ${total > 0 ? Math.round(opened / total * 100) : 0}% (${opened} ouverts)
- Taux de clic : ${total > 0 ? Math.round(clicked / total * 100) : 0}% (${clicked} cliqués)
- Bounces : ${bounced}
- Réponses reçues : ${replied}
- Retombées presse validées : ${retombees}
${clippingsList ? `\n**Articles publiés :**\n${clippingsList}` : ''}

Rédige en français, ton professionnel et factuel. Commence par les points forts, puis les axes d'amélioration. Sois direct et concis.`,
      }],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' };
  }
}

export async function updateCampaignAction(
  campaignId: string,
  data: {
    name: string;
    description?: string;
    target_date?: string;
    tags?: string;
    keywords?: string;
    follow_up_intro?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const tags = data.tags
    ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  const keywords = data.keywords
    ? data.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from('campaigns')
    .update({
      name: data.name,
      description: data.description || null,
      target_date: data.target_date || null,
      tags,
      keywords,
      follow_up_intro: data.follow_up_intro?.trim() || null,
    })
    .eq('id', campaignId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true };
}

export async function deleteEmailSendsAction(
  campaignId: string,
  sendIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!sendIds.length) return { success: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { error } = await supabase
    .from('email_sends')
    .delete()
    .in('id', sendIds)
    .eq('campaign_id', campaignId);

  if (error) return { success: false, error: error.message };

  // Recalculate total_sent from remaining sent rows
  const { count } = await supabase
    .from('email_sends')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'delivered', 'opened', 'clicked']);

  await supabase
    .from('campaigns')
    .update({ total_sent: count ?? 0 })
    .eq('id', campaignId);

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true };
}

export type PressReleaseFormState = {
  success: boolean;
  error?: string;
  data?: {
    id: string;
    version: number;
  };
};

export type AIAnalysisResult = {
  success: boolean;
  error?: string;
  scores?: {
    global: number;
    accroche: number;
    lisibilite: number;
    structure: number;
    angle_media: number;
    suggestions: string[];
  };
};

export type AIRewriteResult = {
  success: boolean;
  error?: string;
  content?: string;
};

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function savePressReleaseAction(
  campaignId: string,
  formData: FormData
): Promise<PressReleaseFormState> {
  const supabase = await createClient();

  const userId = await getUserId(supabase);
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  const title = (formData.get('title') as string) || 'Sans titre';
  const subtitle = (formData.get('subtitle') as string) || null;
  const body_html = (formData.get('body_html') as string) || null;
  const email_subject = (formData.get('email_subject') as string) || null;
  const email_preview_text = (formData.get('email_preview_text') as string) || null;
  const existingId = (formData.get('press_release_id') as string) || null;

  // Plain text version: strip basic HTML tags
  const body_plain = body_html
    ? body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : null;

  if (existingId) {
    // Update existing press release
    const { data, error } = await supabase
      .from('press_releases')
      .update({
        title,
        subtitle,
        body_html,
        body_plain,
        email_subject,
        email_preview_text,
      })
      .eq('id', existingId)
      .eq('campaign_id', campaignId)
      .select('id, version')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
    return { success: true, data: { id: data.id, version: data.version } };
  } else {
    // Create new press release (first one for this campaign)
    const { data, error } = await supabase
      .from('press_releases')
      .insert({
        campaign_id: campaignId,
        title,
        subtitle,
        body_html,
        body_plain,
        email_subject,
        email_preview_text,
        is_current: true,
        created_by: userId,
        version: 1,
      })
      .select('id, version')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
    return { success: true, data: { id: data.id, version: data.version } };
  }
}

export async function analyzePressReleaseAction(
  pressReleaseId: string
): Promise<AIAnalysisResult> {
  const supabase = await createClient();

  const userId = await getUserId(supabase);
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Fetch the press release
  const { data: pr, error: fetchError } = await supabase
    .from('press_releases')
    .select('title, subtitle, body_html, campaign_id')
    .eq('id', pressReleaseId)
    .single();

  if (fetchError || !pr) {
    return { success: false, error: 'Communiqué introuvable' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Clé API Anthropic non configurée' };
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    // Le corps enregistré par l'éditeur commence souvent par le titre et le
    // sous-titre : on les retire pour ne pas les présenter trois fois à l'IA
    // (elle signalait systématiquement une « répétition du titre »).
    const bodyText = stripLeadingDuplicates(
      htmlToStructuredText(pr.body_html ?? ''),
      [pr.title, pr.subtitle]
    );

    const systemPrompt = `Tu es un attaché de presse senior et ancien journaliste. Tu évalues des communiqués de presse rédigés pour des PME et marques françaises, destinés à des rédactions généralistes et spécialisées.

GRILLE DE NOTATION (chaque critère sur 100, à appliquer honnêtement sur toute l'échelle) :
- 95 à 100 : irréprochable, un journaliste pourrait le reprendre tel quel.
- 85 à 94 : très bon, aucun défaut réel, au plus un détail de goût.
- 70 à 84 : bon, un ou deux défauts précis qui méritent une retouche.
- 50 à 69 : moyen, plusieurs défauts structurels ou un angle flou.
- Moins de 50 : faible, à retravailler en profondeur.
Un communiqué bien construit DOIT obtenir 85 ou plus. Ne te réfugie pas dans la zone 70 à 80 par prudence : note ce que tu vois.

CRITÈRES :
1. accroche : le titre et le premier paragraphe donnent-ils immédiatement l'information et l'envie de lire ?
2. lisibilite : phrases claires, paragraphes aérés, jargon limité, longueur adaptée à un email.
3. structure : information essentielle en premier, puis preuves, contexte, informations pratiques, contact.
4. angle_media : y a-t-il une vraie information (actualité, chiffre, nouveauté, validation externe, calendrier) qu'une rédaction peut traiter ?
global : note d'ensemble, cohérente avec les quatre critères.

CE QUI N'EST PAS UN DÉFAUT (ne pas pénaliser, ne pas suggérer de le retirer) :
- Les informations pratiques en fin de communiqué : prix, points de vente, disponibilité, contact presse, proposition d'échantillons ou d'interview. Elles sont attendues par les rédactions.
- Un court passage sur l'histoire du fondateur ou de la marque quand il éclaire le produit.
- Un intertitre ou un paragraphe de conclusion qui s'adresse directement aux rédactions.
- Le nom de la marque ou du produit répété dans le texte.
- Une mise en gras de chiffres ou de faits saillants.

SUGGESTIONS :
- Ne propose une suggestion que pour un défaut avéré qui fait perdre des points, en citant le passage concerné et en disant précisément quoi changer. Chaque suggestion doit être une instruction applicable telle quelle par un rédacteur.
- Si le communiqué est bon, renvoie un tableau vide. Zéro suggestion est une réponse normale et attendue pour un bon texte.
- Jamais plus de 4 suggestions. Pas de suggestion de style ou de goût personnel.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni balises markdown, avec exactement ces clés : global, accroche, lisibilite, structure, angle_media (entiers de 0 à 100) et suggestions (tableau de chaînes, éventuellement vide).`;

    const userPrompt = `Communiqué à évaluer.

TITRE : ${pr.title ?? ''}
SOUS-TITRE : ${pr.subtitle ?? ''}

CORPS :
${bodyText}`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = message.content.find((block) => block.type === 'text');
    if (!content || content.type !== 'text') {
      return { success: false, error: 'Réponse IA inattendue' };
    }

    // Extract JSON from response (Claude might wrap it in markdown code blocks)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Format de réponse IA invalide' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<{
      global: number;
      accroche: number;
      lisibilite: number;
      structure: number;
      angle_media: number;
      suggestions: unknown;
    }>;

    const clamp = (n: unknown): number =>
      Math.max(0, Math.min(100, Math.round(typeof n === 'number' && Number.isFinite(n) ? n : 0)));

    const scores = {
      global: clamp(parsed.global),
      accroche: clamp(parsed.accroche),
      lisibilite: clamp(parsed.lisibilite),
      structure: clamp(parsed.structure),
      angle_media: clamp(parsed.angle_media),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 4)
        : [],
    };

    // Save scores to database
    await supabase
      .from('press_releases')
      .update({
        ai_quality_score: scores.global,
        ai_quality_analysis: {
          accroche: scores.accroche,
          lisibilite: scores.lisibilite,
          structure: scores.structure,
          angle_media: scores.angle_media,
        },
        ai_suggestions: scores.suggestions,
      })
      .eq('id', pressReleaseId);

    return { success: true, scores };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: `Erreur IA : ${message}` };
  }
}

export async function rewriteSectionAction(
  instruction: string,
  currentContent: string
): Promise<AIRewriteResult> {
  const supabase = await createClient();

  const userId = await getUserId(supabase);
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Clé API Anthropic non configurée' };
  }

  if (!instruction.trim() || !currentContent.trim()) {
    return { success: false, error: 'Instruction et contenu requis' };
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const prompt = `Tu es un expert en relations presse. L'utilisateur veut modifier ce communiqué.
Instruction: ${instruction}
Contenu actuel: ${currentContent}
N'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–) : reformule avec deux points, virgule ou parenthèses (consigne éditoriale HPR).
Réponds UNIQUEMENT avec le contenu réécrit, sans commentaire.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return { success: false, error: 'Réponse IA inattendue' };
    }

    return { success: true, content: content.text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return { success: false, error: `Erreur IA : ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Helpers d'analyse IA (non exportés : ce fichier est un module 'use server')
// ---------------------------------------------------------------------------

/** Convertit le HTML de l'éditeur en texte structuré (paragraphes, intertitres, listes conservés). */
function htmlToStructuredText(html: string): string {
  const decode = (s: string) =>
    s
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  return decode(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, _lvl, inner) => `\n\n[Intertitre] ${inner}\n\n`)
      .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${inner}`)
      .replace(/<\/(p|div|ul|ol|blockquote)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 1);
}

/** Part des mots du paragraphe présents dans la référence (0 à 1). */
function overlapRatio(paragraph: string, reference: string): number {
  const p = normalizeWords(paragraph);
  if (p.length === 0) return 0;
  const ref = new Set(normalizeWords(reference));
  const hits = p.filter((w) => ref.has(w)).length;
  return hits / p.length;
}

/**
 * Retire en tête du texte les paragraphes qui ne font que répéter le titre
 * ou le sous-titre (l'éditeur les enregistre dans le corps).
 */
function stripLeadingDuplicates(text: string, references: Array<string | null | undefined>): string {
  const refs = references.filter((r): r is string => !!r && r.trim().length > 0);
  if (refs.length === 0) return text;

  const paragraphs = text.split(/\n\s*\n/);
  let dropped = 0;
  while (dropped < paragraphs.length && dropped < refs.length + 1) {
    const para = paragraphs[dropped];
    const isDuplicate = refs.some((ref) => overlapRatio(para, ref) >= 0.8 && overlapRatio(ref, para) >= 0.6);
    if (!isDuplicate) break;
    dropped++;
  }
  return paragraphs.slice(dropped).join('\n\n');
}
