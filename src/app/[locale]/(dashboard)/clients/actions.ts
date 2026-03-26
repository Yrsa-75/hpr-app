'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const clientSchema = z.object({
  name: z.string().min(1).max(100),
  industry: z.string().optional(),
  website: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().url().optional()),
  description: z.string().optional(),
  sender_name: z.string().optional(),
  sender_email: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().email().optional()),
});

export type ClientFormState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
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

export async function createClientAction(
  formData: FormData
): Promise<ClientFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const raw = {
    name: formData.get('name') as string,
    industry: (formData.get('industry') as string) || undefined,
    website: (formData.get('website') as string) || undefined,
    description: (formData.get('description') as string) || undefined,
    sender_name: (formData.get('sender_name') as string) || undefined,
    sender_email: (formData.get('sender_email') as string) || undefined,
  };

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { data, error } = await supabase.from('clients').insert({
    organization_id: organizationId,
    name: parsed.data.name,
    industry: parsed.data.industry ?? null,
    website: parsed.data.website ?? null,
    description: parsed.data.description ?? null,
    sender_name: parsed.data.sender_name ?? null,
    sender_email: parsed.data.sender_email ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  void data;
  revalidatePath('/[locale]/(dashboard)/clients', 'page');
  return { success: true };
}

export async function updateClientAction(
  id: string,
  formData: FormData
): Promise<ClientFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const raw = {
    name: formData.get('name') as string,
    industry: (formData.get('industry') as string) || undefined,
    website: (formData.get('website') as string) || undefined,
    description: (formData.get('description') as string) || undefined,
    sender_name: (formData.get('sender_name') as string) || undefined,
    sender_email: (formData.get('sender_email') as string) || undefined,
  };

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { error } = await supabase
    .from('clients')
    .update({
      name: parsed.data.name,
      industry: parsed.data.industry ?? null,
      website: parsed.data.website ?? null,
      description: parsed.data.description ?? null,
      sender_name: parsed.data.sender_name ?? null,
      sender_email: parsed.data.sender_email ?? null,
    })
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/clients', 'page');
  return { success: true };
}

export async function deleteClientAction(id: string): Promise<ClientFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/clients', 'page');
  return { success: true };
}
