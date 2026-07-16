import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isJournalistSendable } from '@/lib/journalists/sendable';
import { maybeBackfillFollowUpTracking } from '@/lib/email/follow-ups';
import { getAttributionOptions } from '@/lib/clippings/attribution-options';
import { CampaignTabs } from '@/components/campaigns/campaign-tabs';
import { EditCampaignButton } from '@/components/campaigns/edit-campaign-button';
import type { CampaignRow, PressReleaseRow, JournalistRow, ProspectRow } from '@/types/database';
import type { EmailSendWithJoins } from '@/components/campaigns/sending-tab';
import type { FollowUpLite } from '@/components/campaigns/tracking-tab';
import type { ThreadWithJoins } from '@/components/campaigns/replies-tab';
import type { ClippingWithJoins } from '@/app/[locale]/(dashboard)/clippings/page';
import { cn } from '@/lib/utils';

// Le rattrapage du tracking des relances peut prendre ~10-20 s au premier
// chargement (défaut Hobby : 10 s, insuffisant)
export const maxDuration = 60;

type CampaignStatus = CampaignRow['status'];

function getStatusConfig(status: CampaignStatus): { label: string; classes: string } {
  const configs: Record<CampaignStatus, { label: string; classes: string }> = {
    draft: { label: 'Brouillon', classes: 'bg-white/5 text-muted-foreground border-white/10' },
    preparing: { label: 'En préparation', classes: 'bg-blue-950/40 text-blue-400 border-blue-500/20' },
    review: { label: 'En révision', classes: 'bg-amber-950/40 text-amber-400 border-amber-500/20' },
    approved: { label: 'Approuvé', classes: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' },
    sending: { label: 'En cours d\'envoi', classes: 'bg-cyan-950/40 text-cyan-400 border-cyan-500/20' },
    active: { label: 'Actif', classes: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' },
    paused: { label: 'En pause', classes: 'bg-orange-950/40 text-orange-400 border-orange-500/20' },
    completed: { label: 'Terminé', classes: 'bg-violet-950/40 text-violet-400 border-violet-500/20' },
    archived: { label: 'Archivé', classes: 'bg-white/5 text-muted-foreground/50 border-white/5' },
  };
  return configs[status] ?? { label: status, classes: 'bg-white/5 text-muted-foreground' };
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaignId: string; clientId: string; locale: string }>;
}): Promise<Metadata> {
  const { campaignId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaigns')
    .select('name')
    .eq('id', campaignId)
    .single();
  return { title: data?.name ?? 'Campagne' };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string; clientId: string; locale: string }>;
}) {
  const { campaignId, clientId, locale } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return notFound();
  }

  // Fetch campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('client_id', clientId)
    .single();

  if (!campaign) {
    return notFound();
  }

  // Fetch client (with sender info)
  const { data: clientData } = await supabase
    .from('clients')
    .select('name, slug, sender_name, sender_email, email_signature_html')
    .eq('id', clientId)
    .single();

  // Fetch current press release
  const { data: pressRelease } = await supabase
    .from('press_releases')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_current', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isProspectCampaign = campaign.campaign_type === 'prospects';

  // Fetch contacts selon le type de campagne
  const journalists: JournalistRow[] = [];
  const prospects: ProspectRow[] = [];

  if (!isProspectCampaign) {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('journalists')
        .select('*')
        .eq('is_opted_out', false)
        .not('email', 'is', null)
        .not('tags', 'cs', '{"email-bounced"}')
        .order('quality_score', { ascending: false, nullsFirst: false })
        .order('last_name', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      journalists.push(...(data as JournalistRow[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  } else {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('is_opted_out', false)
        .not('email', 'is', null)
        .not('tags', 'cs', '{"email-bounced"}')
        .order('company', { ascending: true })
        .order('last_name', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      prospects.push(...(data as ProspectRow[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  // Fetch email_sends for this campaign
  const { data: emailSends } = await supabase
    .from('email_sends')
    .select('*, journalists(first_name, last_name, email, media_outlet), press_releases(title)')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false });

  const selectedJournalistIds = isProspectCampaign
    ? []
    : (emailSends ?? [])
        .filter((s: { status: string }) => s.status === 'targeted' || s.status === 'queued')
        .map((s: { journalist_id: string | null }) => s.journalist_id)
        .filter((id): id is string => id !== null);

  const selectedProspectIds = isProspectCampaign
    ? (emailSends ?? [])
        .filter((s: { status: string }) => s.status === 'targeted' || s.status === 'queued')
        .map((s: { prospect_id: string | null }) => s.prospect_id)
        .filter((id): id is string => id !== null)
    : [];

  // Ne proposer au ciblage que les journalistes qui passeront le trigger
  // anti-bounce (miroir de trg_block_unverified_email_sends) ; on garde
  // ceux déjà sélectionnés pour permettre leur désélection.
  const selectedJournalistSet = new Set(selectedJournalistIds);
  const targetableJournalists = journalists.filter(
    (j) => isJournalistSendable(j.tags) || selectedJournalistSet.has(j.id)
  );

  // Fetch email threads with journalist info and messages (same shape as inbox)
  const { data: rawThreads } = await supabase
    .from('email_threads')
    .select('*, journalists(first_name, last_name, email, media_outlet), campaigns(id, name, clients(name)), email_messages(*)')
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false });

  // Rattrapage one-shot du tracking Resend des relances envoyées avant le
  // 2026-07-16 (aucun resend_email_id stocké à l'époque). Quick-exit dès
  // qu'il n'y a plus d'orpheline.
  await maybeBackfillFollowUpTracking();

  // Relances automatiques (J+4/J+8) de la campagne, pour l'onglet Suivi
  const { data: followUps } = await supabase
    .from('follow_ups')
    .select('id, sequence, status, delivery_status, scheduled_at, sent_at, opened_at, clicked_at, journalists(first_name, last_name, media_outlet)')
    .eq('campaign_id', campaignId)
    .order('sequence', { ascending: true })
    .order('sent_at', { ascending: false, nullsFirst: true });

  // Fetch press clippings for this campaign
  const { data: clippings } = await supabase
    .from('press_clippings')
    .select('*, campaigns(name), clients(name)')
    .eq('campaign_id', campaignId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  // Options d'attribution (clients + communiqués) pour l'édition des retombées
  const attributionOptions = await getAttributionOptions(supabase);

  const threads = (rawThreads ?? []).map((t) => ({
    ...t,
    email_messages: ((t.email_messages ?? []) as { created_at: string }[]).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  }));

  const statusConfig = getStatusConfig(campaign.status);
  const formattedDate = formatDate(campaign.target_date);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link */}
      <Link
        href={`/${locale}/clients/${clientId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à {clientData?.name ?? 'Client'}
      </Link>

      {/* Campaign header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {campaign.name}
              </h1>
              <span
                className={cn(
                  'inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium',
                  statusConfig.classes
                )}
              >
                {statusConfig.label}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="text-muted-foreground/60">
                Client : <span className="text-muted-foreground">{clientData?.name}</span>
              </span>
              {formattedDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date cible : {formattedDate}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Créé le{' '}
                {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          <EditCampaignButton campaign={campaign as CampaignRow} />
        </div>

        {campaign.description && (
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {campaign.description}
          </p>
        )}

        {/* Tags */}
        {campaign.tags && campaign.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {campaign.tags.map((tag: string) => (
              <span
                key={tag}
                className="inline-block bg-white/5 text-muted-foreground text-xs px-2 py-0.5 rounded-full border border-white/[0.06]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <CampaignTabs
        campaign={campaign as CampaignRow}
        campaignId={campaignId}
        clientId={clientId}
        pressRelease={pressRelease as PressReleaseRow | null}
        journalists={targetableJournalists as JournalistRow[]}
        selectedJournalistIds={selectedJournalistIds}
        prospects={(prospects ?? []) as ProspectRow[]}
        selectedProspectIds={selectedProspectIds}
        emailSends={(emailSends ?? []) as unknown as EmailSendWithJoins[]}
        followUps={(followUps ?? []) as unknown as FollowUpLite[]}
        threads={(threads ?? []) as unknown as ThreadWithJoins[]}
        clippings={(clippings ?? []) as ClippingWithJoins[]}
        clientOptions={attributionOptions.clients}
        campaignOptions={attributionOptions.campaigns}
        client={{
          name: clientData?.name ?? '',
          slug: clientData?.slug ?? null,
          sender_name: clientData?.sender_name ?? null,
          sender_email: clientData?.sender_email ?? null,
          email_signature_html: clientData?.email_signature_html ?? null,
        }}
      />
    </div>
  );
}
