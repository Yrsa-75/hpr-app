'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isJournalistSendable, sendBlockReason } from '@/lib/journalists/sendable';
import type { JournalistRow, ProspectRow, EmailSendRow } from '@/types/database';

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
  return data?.organization_id ?? null;
}

async function fetchAllJournalists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<JournalistRow[]> {
  const PAGE_SIZE = 1000;
  const all: JournalistRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('journalists')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_opted_out', false)
      .not('email', 'is', null)
      .not('tags', 'cs', '{"email-bounced"}')
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('last_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as JournalistRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export async function getTargetingDataAction(campaignId: string): Promise<{
  journalists: JournalistRow[];
  selectedIds: string[];
  pressReleaseId: string | null;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return { journalists: [], selectedIds: [], pressReleaseId: null };

  const [journalists, sendsRes, prRes] = await Promise.all([
    fetchAllJournalists(supabase, orgId),
    supabase
      .from('email_sends')
      .select('journalist_id')
      .eq('campaign_id', campaignId),
    supabase
      .from('press_releases')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('is_current', true)
      .maybeSingle(),
  ]);

  const selectedIds = (sendsRes.data ?? []).map((r) => r.journalist_id);
  const selectedSet = new Set(selectedIds);

  return {
    // Ne proposer que les journalistes qui passeront le trigger anti-bounce
    // (on garde ceux déjà sélectionnés pour permettre leur désélection)
    journalists: journalists.filter(
      (j) => isJournalistSendable(j.tags) || selectedSet.has(j.id)
    ),
    selectedIds,
    pressReleaseId: prRes.data?.id ?? null,
  };
}

export async function toggleJournalistTargetAction(
  campaignId: string,
  pressReleaseId: string,
  journalistId: string,
  selected: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return { success: false, error: 'Unauthorized' };

  if (selected) {
    // Guard: vérifier que le journaliste appartient à l'org, a un email valide et n'est pas bounced
    const { data: journalist } = await supabase
      .from('journalists')
      .select('id, email, is_opted_out, tags')
      .eq('id', journalistId)
      .eq('organization_id', orgId)
      .eq('is_opted_out', false)
      .not('email', 'is', null)
      .maybeSingle();

    if (!journalist) {
      return { success: false, error: 'Journaliste invalide ou email indisponible.' };
    }
    // Miroir du trigger trg_block_unverified_email_sends : message clair
    // avant que l'insert ne soit rejeté par la base
    const blockReason = sendBlockReason(journalist.tags);
    if (blockReason) {
      return { success: false, error: blockReason };
    }

    const { error } = await supabase.from('email_sends').insert({
      campaign_id: campaignId,
      press_release_id: pressReleaseId,
      journalist_id: journalistId,
      status: 'targeted',
    });

    if (error && error.code !== '23505') {
      return { success: false, error: error.message };
    }
  } else {
    // Remove journalist (only if not yet queued/sent — targeted = not yet triggered)
    const { error } = await supabase
      .from('email_sends')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('journalist_id', journalistId)
      .eq('status', 'targeted');

    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true };
}

export async function getEmailSendsAction(campaignId: string): Promise<EmailSendRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('email_sends')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  return (data ?? []) as EmailSendRow[];
}

// =============================================
// PROSPECT TARGETING
// =============================================

async function fetchAllProspects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<ProspectRow[]> {
  const PAGE_SIZE = 1000;
  const all: ProspectRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_opted_out', false)
      .not('email', 'is', null)
      .not('tags', 'cs', '{"email-bounced"}')
      .order('company', { ascending: true })
      .order('last_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as ProspectRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export async function getProspectTargetingDataAction(campaignId: string): Promise<{
  prospects: ProspectRow[];
  selectedIds: string[];
  pressReleaseId: string | null;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return { prospects: [], selectedIds: [], pressReleaseId: null };

  const [prospects, sendsRes, prRes] = await Promise.all([
    fetchAllProspects(supabase, orgId),
    supabase
      .from('email_sends')
      .select('prospect_id')
      .eq('campaign_id', campaignId)
      .not('prospect_id', 'is', null),
    supabase
      .from('press_releases')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('is_current', true)
      .maybeSingle(),
  ]);

  return {
    prospects,
    selectedIds: (sendsRes.data ?? []).map((r) => r.prospect_id as string),
    pressReleaseId: prRes.data?.id ?? null,
  };
}

export async function toggleProspectTargetAction(
  campaignId: string,
  pressReleaseId: string,
  prospectId: string,
  selected: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return { success: false, error: 'Unauthorized' };

  if (selected) {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('id, email, is_opted_out, tags')
      .eq('id', prospectId)
      .eq('organization_id', orgId)
      .eq('is_opted_out', false)
      .not('email', 'is', null)
      .maybeSingle();

    if (!prospect) {
      return { success: false, error: 'Prospect invalide ou email indisponible.' };
    }
    const tags: string[] = prospect.tags ?? [];
    if (tags.includes('email-bounced')) {
      return { success: false, error: 'Cet email a déjà généré un bounce — prospect non sélectionnable.' };
    }

    const { error } = await supabase.from('email_sends').insert({
      campaign_id: campaignId,
      press_release_id: pressReleaseId,
      prospect_id: prospectId,
      status: 'targeted',
    });

    if (error && error.code !== '23505') {
      return { success: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from('email_sends')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('prospect_id', prospectId)
      .eq('status', 'targeted');

    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]`, 'page');
  return { success: true };
}
