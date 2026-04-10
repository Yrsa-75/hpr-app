'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'media-pack';

async function getOrgAndClient(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return null;

  const { data: client } = await supabase
    .from('clients')
    .select('id, organization_id')
    .eq('id', clientId)
    .eq('organization_id', profile.organization_id)
    .single();
  if (!client) return null;

  return { organizationId: profile.organization_id, supabase };
}

async function ensureBucket() {
  const serviceClient = createServiceClient();
  try {
    await serviceClient.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: [
        'image/*',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'video/*',
      ],
      fileSizeLimit: 50 * 1024 * 1024, // 50 MB
    });
  } catch {
    // Bucket already exists
  }
}

export type MediaActionState = {
  success: boolean;
  error?: string;
};

export async function uploadMediaAssetAction(
  clientId: string,
  formData: FormData
): Promise<MediaActionState> {
  const ctx = await getOrgAndClient(clientId);
  if (!ctx) return { success: false, error: 'Non autorisé' };

  const file = formData.get('file') as File | null;
  const displayName = (formData.get('display_name') as string | null)?.trim();

  if (!file || file.size === 0) return { success: false, error: 'Fichier manquant' };
  if (!displayName) return { success: false, error: 'Nom du fichier requis' };

  await ensureBucket();

  const serviceClient = createServiceClient();
  const ext = file.name.split('.').pop() ?? 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${clientId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return { success: false, error: 'Erreur upload : ' + uploadError.message };

  const {
    data: { publicUrl },
  } = serviceClient.storage.from(BUCKET).getPublicUrl(path);

  const { error: dbError } = await serviceClient.from('client_media_assets').insert({
    client_id: clientId,
    organization_id: ctx.organizationId,
    file_name: file.name,
    display_name: displayName,
    file_url: publicUrl,
    file_size: file.size,
    mime_type: file.type,
  });

  if (dbError) {
    await serviceClient.storage.from(BUCKET).remove([path]);
    return { success: false, error: 'Erreur base de données' };
  }

  revalidatePath(`/fr/clients/${clientId}`);
  return { success: true };
}

export async function deleteMediaAssetAction(
  clientId: string,
  assetId: string
): Promise<MediaActionState> {
  const ctx = await getOrgAndClient(clientId);
  if (!ctx) return { success: false, error: 'Non autorisé' };

  const serviceClient = createServiceClient();

  const { data: asset } = await serviceClient
    .from('client_media_assets')
    .select('file_url, organization_id')
    .eq('id', assetId)
    .eq('client_id', clientId)
    .single();

  if (!asset) return { success: false, error: 'Fichier introuvable' };
  if (asset.organization_id !== ctx.organizationId)
    return { success: false, error: 'Non autorisé' };

  // Extract storage path from URL
  const url = new URL(asset.file_url);
  const storagePath = url.pathname.split(`/object/public/${BUCKET}/`)[1];
  if (storagePath) {
    await serviceClient.storage.from(BUCKET).remove([storagePath]);
  }

  const { error } = await serviceClient
    .from('client_media_assets')
    .delete()
    .eq('id', assetId);

  if (error) return { success: false, error: 'Erreur suppression' };

  revalidatePath(`/fr/clients/${clientId}`);
  return { success: true };
}
