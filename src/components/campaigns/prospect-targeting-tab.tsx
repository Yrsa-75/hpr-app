'use client';

import * as React from 'react';
import { Search, UserCheck, AlertCircle, X, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { toggleProspectTargetAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/targeting-actions';
import type { ProspectRow } from '@/types/database';

interface ProspectTargetingTabProps {
  campaignId: string;
  prospects: ProspectRow[];
  initialSelectedIds: string[];
  pressReleaseId: string | null;
  onCountChange?: (count: number) => void;
}

export function ProspectTargetingTab({
  campaignId,
  prospects,
  initialSelectedIds,
  pressReleaseId,
  onCountChange,
}: ProspectTargetingTabProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    new Set(initialSelectedIds)
  );

  React.useEffect(() => {
    onCountChange?.(selectedIds.size);
  }, [selectedIds, onCountChange]);

  const [search, setSearch] = React.useState('');
  const [selectedSectors, setSelectedSectors] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const allSectors = React.useMemo(() => {
    const s = new Set<string>();
    prospects.forEach((p) => { if (p.sector) s.add(p.sector); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [prospects]);

  const hasActiveFilters = selectedSectors.size > 0 || !!search;

  const filtered = prospects.filter((p) => {
    const q = search.toLowerCase();
    if (
      q &&
      !(
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        (p.role ?? '').toLowerCase().includes(q) ||
        (p.sector ?? '').toLowerCase().includes(q)
      )
    )
      return false;
    if (selectedSectors.size > 0 && !selectedSectors.has(p.sector ?? '')) return false;
    return true;
  });

  const selectedInFiltered = filtered.filter((p) => selectedIds.has(p.id)).length;

  function toggleSector(s: string) {
    setSelectedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  const handleToggle = async (prospectId: string) => {
    if (!pressReleaseId) return;
    if (pending.has(prospectId)) return;

    const nowSelected = !selectedIds.has(prospectId);
    setPending((p) => new Set(p).add(prospectId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (nowSelected) next.add(prospectId);
      else next.delete(prospectId);
      return next;
    });

    const result = await toggleProspectTargetAction(campaignId, pressReleaseId, prospectId, nowSelected);
    setPending((p) => {
      const next = new Set(p);
      next.delete(prospectId);
      return next;
    });

    if (!result.success) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (nowSelected) next.delete(prospectId);
        else next.add(prospectId);
        return next;
      });
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  const handleSelectAll = async () => {
    if (!pressReleaseId) {
      toast({
        title: 'Communiqué manquant',
        description: "Enregistrez d'abord un communiqué.",
        variant: 'destructive',
      });
      return;
    }
    for (const p of filtered) {
      if (!selectedIds.has(p.id)) await handleToggle(p.id);
    }
  };

  const handleDeselectAll = async () => {
    for (const p of filtered) {
      if (selectedIds.has(p.id)) await handleToggle(p.id);
    }
  };

  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm text-foreground">Sélection des prospects</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedIds.size} prospect{selectedIds.size !== 1 ? 's' : ''} ciblé{selectedIds.size !== 1 ? 's' : ''}
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
          Enregistrez d&apos;abord un communiqué dans l&apos;onglet &quot;Communiqué&quot; avant de cibler des prospects.
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher un prospect, une entreprise, un poste..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/[0.03] border-white/[0.08] text-sm h-9"
        />
      </div>

      {/* Filtres secteurs */}
      {allSectors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground/70 font-medium uppercase tracking-wide">Secteur</p>
          <div className="flex flex-wrap gap-1.5">
            {allSectors.map((sector) => {
              const active = selectedSectors.has(sector);
              const count = prospects.filter((p) => p.sector === sector).length;
              return (
                <button
                  key={sector}
                  onClick={() => toggleSector(sector)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-hpr-gold/15 border-hpr-gold/40 text-hpr-gold'
                      : 'bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {sector}
                  <span className={`text-[12px] ${active ? 'text-hpr-gold/70' : 'text-muted-foreground/50'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compteur + effacer */}
      <div className="flex items-center gap-3">
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setSelectedSectors(new Set()); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Effacer les filtres
          </button>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          <span className="text-foreground">{selectedInFiltered}</span>
          {' / '}
          <span className="text-foreground">{filtered.length}</span>
        </span>
      </div>

      {/* Liste prospects */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {prospects.length === 0
            ? 'Aucun prospect avec email dans votre base. Commencez par en importer.'
            : 'Aucun prospect ne correspond à ces filtres.'}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden">
          {filtered.map((prospect) => {
            const isSelected = selectedIds.has(prospect.id);
            const isPending = pending.has(prospect.id);

            return (
              <div
                key={prospect.id}
                onClick={() => handleToggle(prospect.id)}
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
                      {prospect.first_name} {prospect.last_name}
                    </span>
                    {isSelected && (
                      <UserCheck className="h-3 w-3 text-hpr-gold flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Building2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <span className="text-xs text-muted-foreground">{prospect.company}</span>
                    {prospect.role && (
                      <span className="text-xs bg-white/5 text-muted-foreground px-1.5 py-0 rounded">
                        {prospect.role}
                      </span>
                    )}
                    {prospect.sector && (
                      <span className="text-xs text-hpr-gold/60">
                        {prospect.sector}
                      </span>
                    )}
                  </div>
                </div>

                {/* Email indicator */}
                {prospect.email && (
                  <span className="text-xs text-muted-foreground/50 flex-shrink-0 font-mono">
                    {prospect.email.split('@')[1]}
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
