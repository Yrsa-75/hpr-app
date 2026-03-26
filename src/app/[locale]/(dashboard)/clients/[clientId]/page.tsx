import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, ArrowLeft, Megaphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { ClientDetailActions } from '@/components/clients/client-detail-actions';
import type { ClientRow, CampaignRow } from '@/types/database';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clientId: string; locale: string }>;
}): Promise<Metadata> {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('clients').select('name').eq('id', clientId).single();
  return { title: data?.name ?? 'Client' };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; locale: string }>;
}) {
  const { clientId, locale } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return notFound();
  }

  // Fetch client
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (!client) {
    return notFound();
  }

  // Fetch campaigns for this client
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  const campaignList: CampaignRow[] = campaigns ?? [];

  // Build initials
  const initials = (() => {
    const parts = client.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return client.name.slice(0, 2).toUpperCase();
  })();

  const avatarColors = [
    'bg-blue-900/60', 'bg-violet-900/60', 'bg-emerald-900/60', 'bg-rose-900/60',
    'bg-amber-900/60', 'bg-cyan-900/60', 'bg-indigo-900/60', 'bg-teal-900/60',
  ];
  let hash = 0;
  for (let i = 0; i < client.name.length; i++) {
    hash = client.name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const avatarColor = avatarColors[Math.abs(hash) % avatarColors.length];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link */}
      <Link
        href={`/${locale}/clients`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>

      {/* Client header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div
              className={`h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0 ${avatarColor}`}
            >
              <span className="text-lg font-semibold text-white/90">{initials}</span>
            </div>
          )}
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-foreground">{client.name}</h1>
            <div className="flex items-center gap-3">
              {client.industry && (
                <span className="inline-block bg-white/5 text-muted-foreground text-xs px-2.5 py-1 rounded-full border border-white/[0.06]">
                  {client.industry}
                </span>
              )}
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-hpr-gold transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>{client.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
            {client.description && (
              <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                {client.description}
              </p>
            )}
          </div>
        </div>

        {/* Edit client button (client-side component) */}
        <ClientDetailActions client={client as ClientRow} clientId={clientId} showNewCampaign={false} />
      </div>

      {/* Campaigns section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Campagnes
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({campaignList.length})
            </span>
          </h2>
          <ClientDetailActions client={null} clientId={clientId} showNewCampaign={true} />
        </div>

        {campaignList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaignList.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} clientId={clientId} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
              <Megaphone className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-sm font-medium text-foreground mb-1">
              Aucune campagne
            </h3>
            <p className="text-xs text-muted-foreground">
              Créez la première campagne de relations presse pour ce client.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
