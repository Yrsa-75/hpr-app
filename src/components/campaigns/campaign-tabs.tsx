'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Construction } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PressReleaseEditor } from '@/components/campaigns/press-release-editor';
import type { PressReleaseRow } from '@/types/database';

interface CampaignTabsProps {
  campaignId: string;
  clientId: string;
  pressRelease: PressReleaseRow | null;
}

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Construction className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-sm font-medium text-foreground mb-1">
        {label} — Bientôt disponible
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm">
        Cette fonctionnalité sera disponible dans une prochaine version.
      </p>
    </div>
  );
}

export function CampaignTabs({ campaignId, clientId, pressRelease }: CampaignTabsProps) {
  const t = useTranslations('campaigns');

  return (
    <Tabs defaultValue="pressRelease" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="pressRelease">{t('tabs.pressRelease')}</TabsTrigger>
        <TabsTrigger value="targeting">{t('tabs.targeting')}</TabsTrigger>
        <TabsTrigger value="sending">{t('tabs.sending')}</TabsTrigger>
        <TabsTrigger value="tracking">{t('tabs.tracking')}</TabsTrigger>
        <TabsTrigger value="replies">{t('tabs.replies')}</TabsTrigger>
        <TabsTrigger value="clippings">{t('tabs.clippings')}</TabsTrigger>
        <TabsTrigger value="report">{t('tabs.report')}</TabsTrigger>
      </TabsList>

      <TabsContent value="pressRelease">
        <PressReleaseEditor
          campaignId={campaignId}
          initialPressRelease={pressRelease}
        />
      </TabsContent>

      <TabsContent value="targeting">
        <ComingSoonTab label={t('tabs.targeting')} />
      </TabsContent>

      <TabsContent value="sending">
        <ComingSoonTab label={t('tabs.sending')} />
      </TabsContent>

      <TabsContent value="tracking">
        <ComingSoonTab label={t('tabs.tracking')} />
      </TabsContent>

      <TabsContent value="replies">
        <ComingSoonTab label={t('tabs.replies')} />
      </TabsContent>

      <TabsContent value="clippings">
        <ComingSoonTab label={t('tabs.clippings')} />
      </TabsContent>

      <TabsContent value="report">
        <ComingSoonTab label={t('tabs.report')} />
      </TabsContent>
    </Tabs>
  );
}
