'use client';

import * as React from 'react';
import { Search, UserCheck, AlertCircle, X } from 'lucide-react';
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

  React.useEffect(() => {
    onCountChange?.(selectedIds.size);
  }, [selectedIds, onCountChange]);

  const [search, setSearch] = React.useState('');
  const [selectedMediaTypes, setSelectedMediaTypes] = React.useState<Set<string>>(new Set());
  const [selectedBeats, setSelectedBeats] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  // Extraire les thématiques uniques de tous les journalistes
  const allBeats = React.useMemo(() => {
    const beats = new Set<string>();
    journalists.forEach((j) => (j.beat ?? []).forEach((b) => beats.add(b)));
    return Array.from(beats).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [journalists]);

  const hasActiveFilters = selectedMediaTypes.size > 0 || selectedBeats.size > 0 || search;

  const filtered = journalists.filter((j) => {
    const q = search.toLowerCase();
    if (q && !(
      j.first_name.toLowerCase().includes(q) ||
      j.last_name.toLowerCase().includes(q) ||
      (j.media_outlet ?? '').toLowerCase().includes(q) ||
      (j.beat ?? []).some((b) => b.toLowerCase().includes(q))
    )) return false;
    if (selectedMediaTypes.size > 0 && !selectedMediaTypes.has(j.media_type ?? '')) return false;
    if (selectedBeats.size > 0 && !(j.beat ?? []).some((b) => selectedBeats.has(b))) return false;
    return true;
  });

  function toggleMediaType(type: string) {
    setSelectedMediaTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  function toggleBeat(beat: string) {
    setSelectedBeats((prev) => {
      const next = new Set(prev);
      if (next.has(beat)) next.delete(beat); else next.add(beat);
      return next;
    });
  }

  function clearFilters() {
    setSearch('');
    setSelectedMediaTypes(new Set());
    setSelectedBeats(new Set());
  }

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

      {/* Filtres */}
      <div className="space-y-2.5">
        {/* Type de média */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground/70 font-medium uppercase tracking-wide">Type de média</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(MEDIA_TYPE_LABELS).map(([value, label]) => {
              const active = selectedMediaTypes.has(value);
              const count = journalists.filter((j) => j.media_type === value).length;
              if (count === 0) return null;
              return (
                <button
                  key={value}
                  onClick={() => toggleMediaType(value)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-hpr-gold/15 border-hpr-gold/40 text-hpr-gold'
                      : 'bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {label}
                  <span className={`text-[10px] ${active ? 'text-hpr-gold/70' : 'text-muted-foreground/50'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thématiques */}
        {allBeats.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground/70 font-medium uppercase tracking-wide">Thématiques</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {allBeats.map((beat) => {
                const active = selectedBeats.has(beat);
                return (
                  <button
                    key={beat}
                    onClick={() => toggleBeat(beat)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-hpr-gold/15 border-hpr-gold/40 text-hpr-gold'
                        : 'bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:border-white/20 hover:text-foreground'
                    }`}
                  >
                    {beat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Effacer les filtres */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Journalist list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {journalists.length === 0
            ? 'Aucun journaliste dans votre base. Commencez par en importer.'
            : 'Aucun journaliste ne correspond à ces filtres.'}
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
