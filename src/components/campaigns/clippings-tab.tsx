'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Newspaper, RefreshCw } from 'lucide-react';
import { ClippingCard } from '@/components/clippings/clippings-view';
import type { ClippingWithJoins } from '@/app/[locale]/(dashboard)/clippings/page';

interface ClippingsTabProps {
  clippings: ClippingWithJoins[];
}

export function ClippingsTab({ clippings }: ClippingsTabProps) {
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'verified'>('all');
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const router = useRouter();

  const filtered = clippings.filter((c) => {
    if (filter === 'pending') return !c.is_verified;
    if (filter === 'verified') return c.is_verified;
    return true;
  });

  const pendingCount = clippings.filter((c) => !c.is_verified).length;

  function refresh() {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  }

  if (clippings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Newspaper className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-display text-sm font-medium text-foreground mb-1">
          Aucune retombée pour cette campagne
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          La surveillance Google News détectera automatiquement les articles liés à cette campagne.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Filters + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {([
            { key: 'all', label: `Toutes (${clippings.length})` },
            { key: 'pending', label: `À valider${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
            { key: 'verified', label: 'Validées' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                filter === key
                  ? 'bg-hpr-gold/15 text-hpr-gold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8">Aucune retombée dans cette catégorie.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((clipping) => (
            <ClippingCard key={clipping.id} clipping={clipping} />
          ))}
        </div>
      )}
    </div>
  );
}
