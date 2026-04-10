import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ClientDetailActions } from '@/components/clients/client-detail-actions';
import { ClientDetailTabs } from '@/components/clients/client-detail-tabs';
import type { ClientRow, CampaignRow, ClientMediaAssetRow } from '@/types/database';

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

  // Fetch media assets
  const { data: mediaAssets } = await supabase
    .from('client_media_assets')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  const campaignList: CampaignRow[] = campaigns ?? [];
  const assetList: ClientMediaAssetRow[] = mediaAssets ?? [];

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
        <ClientDetailActions
          client={client as ClientRow}
          clientId={clientId}
          clientName={client.name}
          showNewCampaign={false}
        />
      </div>

      {/* Tabs: Campagnes / Pack Média */}
      <ClientDetailTabs
        clientId={clientId}
        clientSlug={client.slug}
        clientName={client.name}
        campaignList={campaignList}
        assetList={assetList}
        locale={locale}
      />
    </div>
  );
}
