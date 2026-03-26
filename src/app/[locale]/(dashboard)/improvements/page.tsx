import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RefreshCw } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('improvements');
  return { title: t('title') };
}

export default async function ImprovementsPage() {
  const t = await getTranslations('improvements');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <RefreshCw className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-display text-sm font-medium text-foreground mb-1">{t('noImprovements')}</h3>
        <p className="text-xs text-muted-foreground">{t('noImprovementsDescription')}</p>
      </div>
    </div>
  );
}
