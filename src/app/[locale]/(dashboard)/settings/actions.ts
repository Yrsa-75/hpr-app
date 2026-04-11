'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── Profile ────────────────────────────────────────────────────────────────

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const full_name = formData.get('full_name') as string;

  const { error } = await supabase
    .from('users')
    .update({ full_name })
    .eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'Aucun fichier' };

  const ext = file.name.split('.').pop();
  const path = `avatars/${user.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);

  await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
  revalidatePath('/', 'layout');
  return { success: true, url: publicUrl };
}

export async function changePasswordAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const password = formData.get('password') as string;
  const confirm = formData.get('confirm') as string;

  if (password !== confirm) return { error: 'Les mots de passe ne correspondent pas' };
  if (password.length < 8) return { error: 'Le mot de passe doit faire au moins 8 caractères' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { success: true };
}

// ─── Organisation ───────────────────────────────────────────────────────────

export async function updateOrganisationAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return { error: 'Organisation introuvable' };

  const name = formData.get('name') as string;

  const { error } = await supabase
    .from('organizations')
    .update({ name })
    .eq('id', profile.organization_id);

  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function uploadOrgLogoAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return { error: 'Organisation introuvable' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'Aucun fichier' };

  const ext = file.name.split('.').pop();
  const path = `orgs/${profile.organization_id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);

  await supabase
    .from('organizations')
    .update({ logo_url: publicUrl })
    .eq('id', profile.organization_id);

  revalidatePath('/', 'layout');
  return { success: true, url: publicUrl };
}

// ─── Intégrations ───────────────────────────────────────────────────────────

export async function updateSlackWebhookAction(webhookUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return { error: 'Organisation introuvable' };

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', profile.organization_id)
    .single();

  const currentSettings = (org?.settings as Record<string, unknown>) ?? {};
  const newSettings = { ...currentSettings, slack_webhook_url: webhookUrl || null };

  const { error } = await supabase
    .from('organizations')
    .update({ settings: newSettings })
    .eq('id', profile.organization_id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function testResendConnectionAction() {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.domains.list();
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: `${(data as { data?: unknown[] })?.data?.length ?? 0} domaine(s) configuré(s)` };
  } catch {
    return { ok: false, message: 'Clé API invalide ou absente' };
  }
}

export async function testAnthropicConnectionAction() {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'ping' }],
    });
    return { ok: true, message: 'Connexion active' };
  } catch {
    return { ok: false, message: 'Clé API invalide ou absente' };
  }
}

// ─── Notifications preferences ──────────────────────────────────────────────

export async function updateNotificationPreferencesAction(
  prefs: Record<string, boolean>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const { data: profile } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', user.id)
    .single();

  const current = (profile?.preferences as Record<string, unknown>) ?? {};
  const updated = { ...current, notifications: prefs };

  const { error } = await supabase
    .from('users')
    .update({ preferences: updated })
    .eq('id', user.id);

  if (error) return { error: error.message };
  return { success: true };
}
