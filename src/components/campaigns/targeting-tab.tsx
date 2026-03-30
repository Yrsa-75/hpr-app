'use client';

import * as React from 'react';
import { Search, UserCheck, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { toggleJournalistTargetAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/targeting-actions';
import type { JournalistRow } from '@/types/database';

interface TargetingTabProps {
  campaignId: string;
  journalists: JournalistRow[];
  initialSelectedIds: string[];
  pressReleaseId: string | null;
  onCountChange?: (count: number) => void;
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  presse_ecrite: 'Presse écrite',
  tv: 'TV',
  radio: 'Radio',
  web: 'Web',
  podcast: 'Podcast',
  blog: 'Blog',
  influenceur: 'Influenceur',
};

export function TargetingTab({
  campaignId,
  journalists,
  initialSelectedIds,
  pressReleaseId,
  onCountChange,
}: TargetingTabProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    new Set(initialSelectedIds)
  );

  // Notify parent of count changes
  React.useEffect(() => {
    onCountChange?.(selectedIds.size);
  }, [selectedIds, onCountChange]);
  const [search, setSearch] = React.useState('');
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const filtered = journalists.filter((j) => {
    const q = search.toLowerCase();
    return (
      !q ||
      j.first_name.toLowerCase().includes(q) ||
      j.last_name.toLowerCase().includes(q) ||
      (j.media_outlet ?? '').toLowerCase().includes(q) ||
      (j.beat ?? []).some((b) => b.toLowerCase().includes(q))
    );
  });

  const handleToggle = async (journalistId: string) => {
    if (!pressReleaseId) return;
    if (pending.has(journalistId)) return;

    const nowSelected = !selectedIds.has(journalistId);
    setPending((p) => new Set(p).add(journalistId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (nowSelected) next.add(journalistId);
      else next.delete(journalistId);
      return next;
    });

    const result = await toggleJournalistTargetAction(campaignId, pressReleaseId, journalistId, nowSelected);
    setPending((p) => {
      const next = new Set(p);
      next.delete(journalistId);
      return next;
    });

    if (!result.success) {
      // Revert
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (nowSelected) next.delete(journalistId);
        else next.add(journalistId);
        return next;
      });
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  const handleSelectAll = async () => {
    if (!pressReleaseId) {
      toast({
        title: 'Communiqué manquant',
        description: 'Enregistrez d\'abord un communiqué.',
        variant: 'destructive',
      });
      return;
    }
    for (const j of filtered) {
      if (!selectedIds.has(j.id)) {
        await handleToggle(j.id);
      }
    }
  };

  const handleDeselectAll = async () => {
    for (const j of filtered) {
      if (selectedIds.has(j.id)) {
        await handleToggle(j.id);
      }
    }
  };

  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm text-foreground">Sélection des journalistes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedIds.size} journaliste{selectedIds.size !== 1 ? 's' : ''} ciblé{selectedIds.size !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs text-hpr-gold hover:text-hpr-gold/80 transition-colors"
          >
            Tout sélectionner
          </button>
          <span className="text-muted-foreground/30">|</span>
          <button
            onClick={handleDeselectAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Tout désélectionner
          </button>
        </div>
      </div>

      {!pressReleaseId && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Enregistrez d&apos;abord un communiqué dans l&apos;onglet &quot;Communiqué&quot; avant de cibler des journalistes.
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher un journaliste, un média, une thématique..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/[0.03] border-white/[0.08] text-sm h-9"
        />
      </div>

      {/* Journalist list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {journalists.length === 0
            ? 'Aucun journaliste dans votre base. Commencez par en importer.'
            : 'Aucun résultat pour cette recherche.'}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden">
          {filtered.map((journalist) => {
            const isSelected = selectedIds.has(journalist.id);
            const isPending = pending.has(journalist.id);

            return (
              <div
                key={journalist.id}
                onClick={() => handleToggle(journalist.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-hpr-gold/5 hover:bg-hpr-gold/8'
                    : 'bg-white/[0.01] hover:bg-white/[0.04]'
                } ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {/* Checkbox */}
                <div
                  className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-hpr-gold border-hpr-gold'
                      : 'border-white/20 bg-transparent'
                  }`}
                >
                  {isSelected && (
                    <svg className="h-2.5 w-2.5 text-black" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {journalist.first_name} {journalist.last_name}
                    </span>
                    {isSelected && (
                      <UserCheck className="h-3 w-3 text-hpr-gold flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {journalist.media_outlet && (
                      <span className="text-xs text-muted-foreground">{journalist.media_outlet}</span>
                    )}
                    {journalist.media_type && (
                      <span className="text-xs bg-white/5 text-muted-foreground px-1.5 py-0 rounded">
                        {MEDIA_TYPE_LABELS[journalist.media_type] ?? journalist.media_type}
                      </span>
                    )}
                    {journalist.beat && journalist.beat.length > 0 && (
                      <span className="text-xs text-muted-foreground/60">
                        {journalist.beat.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quality score */}
                {journalist.quality_score != null && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    Score: <span className="text-foreground font-medium">{journalist.quality_score}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
