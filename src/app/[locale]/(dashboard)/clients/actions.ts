'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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
  signature_text: z.string().optional(),
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

async function uploadSignatureLogo(file: File, clientId: string): Promise<string | null> {
  const serviceClient = createServiceClient();

  // Ensure bucket exists
  try {
    await serviceClient.storage.createBucket('signatures', {
      public: true,
      allowedMimeTypes: ['image/*'],
      fileSizeLimit: 2 * 1024 * 1024,
    });
  } catch {
    // Bucket already exists — OK
  }

  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${clientId}/signature-logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await serviceClient.storage
    .from('signatures')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) return null;

  const { data: { publicUrl } } = serviceClient.storage
    .from('signatures')
    .getPublicUrl(path);

  return publicUrl;
}

function buildSignatureHtml(logoUrl: string | null, signatureText: string | null): string | null {
  if (!logoUrl && !signatureText) return null;

  const lines = (signatureText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const textHtml = lines
    .map((line, i) =>
      i === 0
        ? `<div style="font-weight:600;font-size:13px;color:#1a1a1a;line-height:1.4;">${line}</div>`
        : `<div style="font-size:12px;color:#555;line-height:1.4;">${line}</div>`
    )
    .join('');

  if (logoUrl && lines.length > 0) {
    return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;">
  <tr>
    <td style="padding-right:14px;vertical-align:middle;">
      <img src="${logoUrl}" alt="Logo" style="max-width:150px;width:auto;height:auto;display:block;" />
    </td>
    <td style="border-left:2px solid #B8860B;padding-left:14px;vertical-align:middle;">
      ${textHtml}
    </td>
  </tr>
</table>`;
  }

  if (logoUrl) {
    return `<img src="${logoUrl}" alt="Logo" style="max-width:150px;width:auto;height:auto;display:block;" />`;
  }

  return `<div style="font-family:Arial,sans-serif;">${textHtml}</div>`;
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
    signature_text: (formData.get('signature_text') as string) || undefined,
  };

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Insert client first to get the ID
  const { data: newClient, error: insertError } = await supabase
    .from('clients')
    .insert({
      organization_id: organizationId,
      name: parsed.data.name,
      industry: parsed.data.industry ?? null,
      website: parsed.data.website ?? null,
      description: parsed.data.description ?? null,
      sender_name: parsed.data.sender_name ?? null,
      sender_email: parsed.data.sender_email ?? null,
      signature_text: parsed.data.signature_text ?? null,
    })
    .select('id')
    .single();

  if (insertError || !newClient) {
    return { success: false, error: insertError?.message ?? 'Erreur création client' };
  }

  // Handle logo upload if provided
  const logoFile = formData.get('signature_logo') as File | null;
  let signatureLogoUrl: string | null = null;

  if (logoFile && logoFile.size > 0) {
    signatureLogoUrl = await uploadSignatureLogo(logoFile, newClient.id);
  }

  // Generate and save signature HTML
  const signatureHtml = buildSignatureHtml(signatureLogoUrl, parsed.data.signature_text ?? null);

  if (signatureLogoUrl || signatureHtml) {
    await supabase
      .from('clients')
      .update({
        logo_url: signatureLogoUrl,
        signature_logo_url: signatureLogoUrl,
        email_signature_html: signatureHtml,
      })
      .eq('id', newClient.id);
  }

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
    signature_text: (formData.get('signature_text') as string) || undefined,
  };

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Handle logo upload if a new file was provided
  const logoFile = formData.get('signature_logo') as File | null;
  const keepExistingLogo = formData.get('keep_existing_logo') === 'true';

  // Fetch existing logo URL if needed
  let signatureLogoUrl: string | null = null;
  if (keepExistingLogo) {
    const { data: existing } = await supabase
      .from('clients')
      .select('signature_logo_url')
      .eq('id', id)
      .single();
    signatureLogoUrl = existing?.signature_logo_url ?? null;
  }

  if (logoFile && logoFile.size > 0) {
    signatureLogoUrl = await uploadSignatureLogo(logoFile, id);
  }

  const signatureHtml = buildSignatureHtml(signatureLogoUrl, parsed.data.signature_text ?? null);

  const { error } = await supabase
    .from('clients')
    .update({
      name: parsed.data.name,
      industry: parsed.data.industry ?? null,
      website: parsed.data.website ?? null,
      description: parsed.data.description ?? null,
      sender_name: parsed.data.sender_name ?? null,
      sender_email: parsed.data.sender_email ?? null,
      signature_text: parsed.data.signature_text ?? null,
      logo_url: signatureLogoUrl,
      signature_logo_url: signatureLogoUrl,
      email_signature_html: signatureHtml,
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
