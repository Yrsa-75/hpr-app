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

    const prompt = `Tu es un expert en relations presse. Analyse ce communiqué et donne un score sur 100 pour chaque critère :
1. Accroche (titre et premier paragraphe accrocheurs ?)
2. Lisibilité (clarté, longueur des phrases, jargon)
3. Structure (pyramide inversée, codes RP)
4. Angle média (info réelle ou pub déguisée ?)

Communiqué :
TITRE: ${pr.title}
SOUS-TITRE: ${pr.subtitle ?? ''}
CORPS: ${pr.body_html?.replace(/<[^>]+>/g, ' ').trim() ?? ''}

Réponds UNIQUEMENT en JSON avec ce format exact :
{
  "global": 75,
  "accroche": 80,
  "lisibilite": 70,
  "structure": 75,
  "angle_media": 75,
  "suggestions": [
    "Suggestion concrète 1",
    "Suggestion concrète 2",
    "Suggestion concrète 3"
  ]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return { success: false, error: 'Réponse IA inattendue' };
    }

    // Extract JSON from response (Claude might wrap it in markdown code blocks)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Format de réponse IA invalide' };
    }

    const scores = JSON.parse(jsonMatch[0]) as {
      global: number;
      accroche: number;
      lisibilite: number;
      structure: number;
      angle_media: number;
      suggestions: string[];
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
