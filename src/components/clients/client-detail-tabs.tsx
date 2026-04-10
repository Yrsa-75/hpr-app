'use client';

import * as React from 'react';
import { Megaphone, Package } from 'lucide-react';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { ClientDetailActions } from '@/components/clients/client-detail-actions';
import { MediaPackTab } from '@/components/clients/media-pack-tab';
import type { CampaignRow, ClientMediaAssetRow } from '@/types/database';

interface ClientDetailTabsProps {
  clientId: string;
  clientSlug: string | null;
  clientName: string;
  campaignList: CampaignRow[];
  assetList: ClientMediaAssetRow[];
  locale: string;
}

type Tab = 'campaigns' | 'media';

export function ClientDetailTabs({
  clientId,
  clientSlug,
  clientName,
  campaignList,
  assetList,
  locale,
}: ClientDetailTabsProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>('campaigns');

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'campaigns'
              ? 'border-hpr-gold text-hpr-gold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Megaphone className="h-4 w-4" />
          Campagnes
          <span className="text-xs opacity-70">({campaignList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'media'
              ? 'border-hpr-gold text-hpr-gold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4" />
          Pack Média
          {assetList.length > 0 && (
            <span className="text-xs opacity-70">({assetList.length})</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <ClientDetailActions
              client={null}
              clientId={clientId}
              clientName={clientName}
              showNewCampaign={true}
            />
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
      )}

      {activeTab === 'media' && (
        <MediaPackTab
          clientId={clientId}
          clientSlug={clientSlug}
          assets={assetList}
        />
      )}
    </div>
  );
}
