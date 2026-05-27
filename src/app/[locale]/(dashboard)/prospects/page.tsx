import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Target } from 'lucide-react';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ProspectsHeader } from '@/components/prospects/prospects-header';
import { ProspectsTable } from '@/components/prospects/prospects-table';
import type { ProspectRow } from '@/types/database';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('prospects');
  return { title: t('title') };
}

export default async function ProspectsPage() {
  const t = await getTranslations('prospects');
  const tCommon = await getTranslations('common');

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let prospects: ProspectRow[] = [];
  let organizationId: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    organizationId = profile?.organization_id ?? null;

    if (organizationId) {
      const serviceClient = createServiceClient();
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data: page } = await serviceClient
          .from('prospects')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);

        if (!page || page.length === 0) break;
        prospects.push(...(page as ProspectRow[]));
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }
  }

  const totalCount = prospects.length;
  const verifiedCount = prospects.filter(
    (p) =>
      p.email &&
      (p.tags?.includes('validate') ||
        p.tags?.includes('via-hunter') ||
        p.tags?.includes('email-verified'))
  ).length;
  const optedOutCount = prospects.filter((p) => p.is_opted_out).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <ProspectsHeader />

      {totalCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{tCommon('total')} prospects</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-2xl font-bold text-green-400">{verifiedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('isVerified')}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-2xl font-bold text-orange-400">{optedOutCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('isOptedOut')}</p>
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <Target className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display text-sm font-medium text-foreground mb-1">
            {t('noProspects')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('noProspectsDescription')}</p>
        </div>
      ) : (
        <ProspectsTable prospects={prospects} />
      )}
    </div>
  );
}
