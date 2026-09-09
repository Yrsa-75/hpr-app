'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function verifyClippingAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { error } = await supabase
    .from('press_clippings')
    .update({ is_verified: true })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/clippings', 'page');
  return { success: true };
}

/**
 * Attribue une retombée à un client et (optionnellement) à un communiqué (via sa campagne).
 * campaignId = null → retombée spontanée (hors communiqué).
 */
export async function attributeClippingAction(
  id: string,
  clientId: string,
  campaignId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!clientId) return { success: false, error: 'Client requis' };

  // Cohérence : si un communiqué est choisi, sa campagne doit appartenir au client sélectionné.
  if (campaignId) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('client_id')
      .eq('id', campaignId)
      .single();
    if (!campaign) return { success: false, error: 'Communiqué introuvable' };
    if (campaign.client_id !== clientId) {
      return { success: false, error: 'Ce communiqué n\'appartient pas au client sélectionné' };
    }
  }

  const { error } = await supabase
    .from('press_clippings')
    .update({ client_id: clientId, campaign_id: campaignId })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/clippings', 'page');
  revalidatePath('/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]', 'page');
  return { success: true };
}

export type AddClippingInput = {
  url: string;
  title: string;
  source_name: string;
  source_type: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'social_media';
  published_at: string | null;
  client_id: string;
  campaign_id: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  excerpt: string | null;
};

/**
 * Ajoute une retombée saisie manuellement par l'utilisateur.
 * Créée directement vérifiée (is_verified = true) : c'est une saisie humaine, pas une détection.
 */
export async function addClippingAction(
  input: AddClippingInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!input.client_id) return { success: false, error: 'Client requis' };
  if (!input.url || !input.title || !input.source_name) {
    return { success: false, error: 'URL, titre et média sont obligatoires' };
  }

  // Cohérence : si un communiqué est choisi, sa campagne doit appartenir au client sélectionné.
  if (input.campaign_id) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('client_id')
      .eq('id', input.campaign_id)
      .single();
    if (!campaign) return { success: false, error: 'Communiqué introuvable' };
    if (campaign.client_id !== input.client_id) {
      return { success: false, error: 'Ce communiqué n\'appartient pas au client sélectionné' };
    }
  }

  const { error } = await supabase.from('press_clippings').insert({
    url: input.url,
    title: input.title,
    source_name: input.source_name,
    source_type: input.source_type,
    published_at: input.published_at,
    client_id: input.client_id,
    campaign_id: input.campaign_id,
    sentiment: input.sentiment,
    excerpt: input.excerpt,
    detection_method: 'manual',
    is_verified: true,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/clippings', 'page');
  revalidatePath('/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]', 'page');
  return { success: true };
}

export async function deleteClippingAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { error } = await supabase
    .from('press_clippings')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/clippings', 'page');
  return { success: true };
}
