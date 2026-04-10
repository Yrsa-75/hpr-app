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

export type SignedUploadUrlResult = {
  success: boolean;
  error?: string;
  signedUrl?: string;
  path?: string;
  publicUrl?: string;
};

/** Étape 1 : génère une URL signée pour upload direct depuis le browser */
export async function getSignedUploadUrlAction(
  clientId: string,
  fileName: string,
  fileSize: number
): Promise<SignedUploadUrlResult> {
  if (fileSize > 50 * 1024 * 1024) {
    return { success: false, error: 'Fichier trop volumineux (max 50 Mo)' };
  }

  const ctx = await getOrgAndClient(clientId);
  if (!ctx) return { success: false, error: 'Non autorisé' };

  await ensureBucket();

  const serviceClient = createServiceClient();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${clientId}/${Date.now()}-${safeName}`;

  const { data, error } = await serviceClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { success: false, error: 'Impossible de générer l\'URL d\'upload' };
  }

  const { data: { publicUrl } } = serviceClient.storage.from(BUCKET).getPublicUrl(path);

  return { success: true, signedUrl: data.signedUrl, path, publicUrl };
}

/** Étape 2 : enregistre le fichier en DB après upload direct */
export async function registerMediaAssetAction(
  clientId: string,
  payload: {
    fileName: string;
    displayName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }
): Promise<MediaActionState> {
  const ctx = await getOrgAndClient(clientId);
  if (!ctx) return { success: false, error: 'Non autorisé' };

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.from('client_media_assets').insert({
    client_id: clientId,
    organization_id: ctx.organizationId,
    file_name: payload.fileName,
    display_name: payload.displayName,
    file_url: payload.fileUrl,
    file_size: payload.fileSize,
    mime_type: payload.mimeType,
  });

  if (error) return { success: false, error: 'Erreur base de données' };

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
