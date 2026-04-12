import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UserSearch } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { JournalistsHeader } from '@/components/journalists/journalists-header';
import { JournalistsTable } from '@/components/journalists/journalists-table';
import type { JournalistRow } from '@/types/database';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('journalists');
  return { title: t('title') };
}

export default async function JournalistsPage() {
  const t = await getTranslations('journalists');
  const tCommon = await getTranslations('common');

  const supabase = await createClient();

  // Get current user's org
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let journalists: JournalistRow[] = [];
  let organizationId: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    organizationId = profile?.organization_id ?? null;

    if (organizationId) {
      const { data } = await supabase
        .from('journalists')
        .select('*')
        .or(`organization_id.eq.${organizationId},is_global.eq.true`)
        .order('is_global', { ascending: true }) // journalistes perso en premier
        .order('created_at', { ascending: false });

      journalists = data ?? [];
    }
  }

  const totalCount = journalists.length;
  const verifiedCount = journalists.filter((j) => j.tags?.includes('validate')).length;
  const optedOutCount = journalists.filter((j) => j.is_opted_out).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with action buttons */}
      <JournalistsHeader />

      {/* Stats bar */}
      {totalCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-xs text-muted-foreground/60">{totalCount} journalistes</p>
            <p className="text-2xl font-bold text-hpr-gold mt-0.5">{verifiedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">contacts validés ✓</p>
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

      {/* Content */}
      {totalCount === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <UserSearch className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display text-sm font-medium text-foreground mb-1">
            {t('noJournalists')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('noJournalistsDescription')}</p>
        </div>
      ) : (
        <JournalistsTable journalists={journalists} />
      )}
    </div>
  );
}
