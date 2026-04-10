'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Construction } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PressReleaseEditor } from '@/components/campaigns/press-release-editor';
import { TargetingTab } from '@/components/campaigns/targeting-tab';
import { SendingTab, type EmailSendWithJoins } from '@/components/campaigns/sending-tab';
import { TrackingTab } from '@/components/campaigns/tracking-tab';
import { RepliesTab, type ThreadWithJoins } from '@/components/campaigns/replies-tab';
import { ClippingsTab } from '@/components/campaigns/clippings-tab';
import type { PressReleaseRow, JournalistRow } from '@/types/database';
import type { ClippingWithJoins } from '@/app/[locale]/(dashboard)/clippings/page';

interface ClientInfo {
  name: string;
  slug: string | null;
  sender_name: string | null;
  sender_email: string | null;
  email_signature_html: string | null;
}

interface CampaignTabsProps {
  campaignId: string;
  clientId: string;
  pressRelease: PressReleaseRow | null;
  journalists: JournalistRow[];
  selectedJournalistIds: string[];
  emailSends: EmailSendWithJoins[];
  threads: ThreadWithJoins[];
  clippings: ClippingWithJoins[];
  client: ClientInfo;
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

export function CampaignTabs({
  campaignId,
  clientId,
  pressRelease,
  journalists,
  selectedJournalistIds,
  emailSends,
  threads,
  clippings,
  client,
}: CampaignTabsProps) {
  const t = useTranslations('campaigns');

  // Local count synced from TargetingTab via callback
  const [targetCount, setTargetCount] = React.useState(
    selectedJournalistIds.length
  );

  return (
    <Tabs defaultValue="pressRelease" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="pressRelease">{t('tabs.pressRelease')}</TabsTrigger>
        <TabsTrigger value="targeting">
          {t('tabs.targeting')}
          {targetCount > 0 && (
            <span className="ml-1.5 text-[10px] bg-hpr-gold/20 text-hpr-gold px-1.5 py-0 rounded-full">
              {targetCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="sending">{t('tabs.sending')}</TabsTrigger>
        <TabsTrigger value="tracking">{t('tabs.tracking')}</TabsTrigger>
        <TabsTrigger value="replies">
          {t('tabs.replies')}
          {threads.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-white/10 text-muted-foreground px-1.5 py-0 rounded-full">
              {threads.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="clippings">
          {t('tabs.clippings')}
          {clippings.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-white/10 text-muted-foreground px-1.5 py-0 rounded-full">
              {clippings.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="report">{t('tabs.report')}</TabsTrigger>
      </TabsList>

      <TabsContent value="pressRelease">
        <PressReleaseEditor
          campaignId={campaignId}
          initialPressRelease={pressRelease}
        />
      </TabsContent>

      <TabsContent value="targeting">
        <TargetingTab
          campaignId={campaignId}
          journalists={journalists}
          initialSelectedIds={selectedJournalistIds}
          pressReleaseId={pressRelease?.id ?? null}
          onCountChange={setTargetCount}
        />
      </TabsContent>

      <TabsContent value="sending">
        <SendingTab
          campaignId={campaignId}
          pressRelease={pressRelease}
          emailSends={emailSends}
          client={client}
        />
      </TabsContent>

      <TabsContent value="tracking">
        <TrackingTab emailSends={emailSends} campaignId={campaignId} />
      </TabsContent>

      <TabsContent value="replies">
        <RepliesTab threads={threads} />
      </TabsContent>

      <TabsContent value="clippings">
        <ClippingsTab clippings={clippings} />
      </TabsContent>

      <TabsContent value="report">
        <ComingSoonTab label={t('tabs.report')} />
      </TabsContent>
    </Tabs>
  );
}
