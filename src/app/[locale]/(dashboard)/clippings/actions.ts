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
