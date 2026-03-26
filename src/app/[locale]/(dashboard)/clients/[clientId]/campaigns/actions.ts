'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const campaignSchema = z.object({
  name: z.string().min(1, 'Ce champ est obligatoire').max(200),
  description: z.string().optional(),
  target_date: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  embargo_until: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  tags: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  keywords: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
});

export type CampaignFormState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  campaignId?: string;
};

async function getOrganizationId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  return profile?.organization_id ?? null;
}

export async function createCampaignAction(
  clientId: string,
  formData: FormData
): Promise<CampaignFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    target_date: (formData.get('target_date') as string) || undefined,
    embargo_until: (formData.get('embargo_until') as string) || undefined,
    tags: (formData.get('tags') as string) || undefined,
    keywords: (formData.get('keywords') as string) || undefined,
  };

  const parsed = campaignSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const tagsArray = parsed.data.tags
    ? parsed.data.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  const keywordsArray = parsed.data.keywords
    ? parsed.data.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : null;

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      target_date: parsed.data.target_date ?? null,
      embargo_until: parsed.data.embargo_until ?? null,
      tags: tagsArray,
      keywords: keywordsArray,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]`, 'page');
  return { success: true, campaignId: data.id };
}

export async function updateCampaignAction(
  campaignId: string,
  formData: FormData
): Promise<CampaignFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    target_date: (formData.get('target_date') as string) || undefined,
    embargo_until: (formData.get('embargo_until') as string) || undefined,
    tags: (formData.get('tags') as string) || undefined,
    keywords: (formData.get('keywords') as string) || undefined,
  };

  const parsed = campaignSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const tagsArray = parsed.data.tags
    ? parsed.data.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : null;

  const keywordsArray = parsed.data.keywords
    ? parsed.data.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : null;

  const { error } = await supabase
    .from('campaigns')
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      target_date: parsed.data.target_date ?? null,
      embargo_until: parsed.data.embargo_until ?? null,
      tags: tagsArray,
      keywords: keywordsArray,
    })
    .eq('id', campaignId)
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true, campaignId };
}

export async function deleteCampaignAction(campaignId: string): Promise<CampaignFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Get campaign to find client_id before deleting
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('client_id')
    .eq('id', campaignId)
    .eq('organization_id', organizationId)
    .single();

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  if (campaign?.client_id) {
    revalidatePath(`/[locale]/(dashboard)/clients/[clientId]`, 'page');
    redirect(`/fr/clients/${campaign.client_id}`);
  }

  return { success: true };
}
