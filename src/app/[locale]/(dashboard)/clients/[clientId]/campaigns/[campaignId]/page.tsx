import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CampaignTabs } from '@/components/campaigns/campaign-tabs';
import type { CampaignRow, PressReleaseRow, JournalistRow } from '@/types/database';
import type { EmailSendWithJoins } from '@/components/campaigns/sending-tab';
import { cn } from '@/lib/utils';

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
    .select('name, sender_name, sender_email')
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

  // Fetch org journalists (for targeting)
  const { data: journalists } = await supabase
    .from('journalists')
    .select('*')
    .eq('is_opted_out', false)
    .order('last_name', { ascending: true });

  // Fetch email_sends for this campaign (with journalist + press release info)
  const { data: emailSends } = await supabase
    .from('email_sends')
    .select('*, journalists(first_name, last_name, email, media_outlet), press_releases(title)')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false });

  const selectedJournalistIds = (emailSends ?? []).map((s: { journalist_id: string }) => s.journalist_id);

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
        campaignId={campaignId}
        clientId={clientId}
        pressRelease={pressRelease as PressReleaseRow | null}
        journalists={(journalists ?? []) as JournalistRow[]}
        selectedJournalistIds={selectedJournalistIds}
        emailSends={(emailSends ?? []) as unknown as EmailSendWithJoins[]}
        client={{
          name: clientData?.name ?? '',
          sender_name: clientData?.sender_name ?? null,
          sender_email: clientData?.sender_email ?? null,
        }}
      />
    </div>
  );
}
