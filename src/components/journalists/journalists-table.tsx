'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search, Pencil, Trash2, Loader2, Tag, Layers, X, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { JournalistFormDialog } from '@/components/journalists/journalist-form-dialog';
import { deleteJournalistAction, bulkAddTagAction } from '@/app/[locale]/(dashboard)/journalists/actions';
import type { JournalistRow } from '@/types/database';

const PAGE_SIZE = 50;

const MEDIA_TYPE_COLORS: Record<string, string> = {
  presse_ecrite: 'bg-blue-500/10 text-blue-400',
  tv: 'bg-purple-500/10 text-purple-400',
  radio: 'bg-orange-500/10 text-orange-400',
  web: 'bg-cyan-500/10 text-cyan-400',
  podcast: 'bg-pink-500/10 text-pink-400',
  blog: 'bg-green-500/10 text-green-400',
  influenceur: 'bg-yellow-500/10 text-yellow-400',
};

function ScoreBadge({ score }: { score: number | null }) {
  if (!score || score === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  let variant: 'success' | 'warning' | 'destructive';
  if (score >= 67) variant = 'success';
  else if (score >= 34) variant = 'warning';
  else variant = 'destructive';

  return <Badge variant={variant}>{Math.round(score)}</Badge>;
}

function JournalistInitials({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-foreground/80">
      {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase()}
    </div>
  );
}

interface JournalistsTableProps {
  journalists: JournalistRow[];
}

export function JournalistsTable({ journalists }: JournalistsTableProps) {
  const t = useTranslations('journalists');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [search, setSearch] = React.useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = React.useState('all');
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = React.useState(false);
  const [selectedBeats, setSelectedBeats] = React.useState<string[]>([]);
  const [beatPopoverOpen, setBeatPopoverOpen] = React.useState(false);
  const [sortCol, setSortCol] = React.useState<'name' | 'media' | 'type' | 'score' | 'last_contacted' | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [editingJournalist, setEditingJournalist] = React.useState<JournalistRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = React.useState(false);
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  // Derive unique beats from all journalists
  const allBeats = React.useMemo(() => {
    const beatSet = new Set<string>();
    for (const j of journalists) {
      if (j.beat) {
        for (const b of j.beat) {
          if (b.trim()) beatSet.add(b.trim());
        }
      }
    }
    return Array.from(beatSet).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [journalists]);

  // Derive unique tags from all journalists — always include system tags
  const SYSTEM_TAGS = ['validate'];
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>(SYSTEM_TAGS);
    for (const j of journalists) {
      if (j.tags) {
        for (const tag of j.tags) {
          if (tag.trim()) tagSet.add(tag.trim());
        }
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [journalists]);

  const filtered = React.useMemo(() => {
    const list = journalists.filter((j) => {
      const matchesSearch =
        !search ||
        `${j.first_name} ${j.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        j.email.toLowerCase().includes(search.toLowerCase()) ||
        (j.media_outlet ?? '').toLowerCase().includes(search.toLowerCase());

      const matchesType =
        mediaTypeFilter === 'all' || j.media_type === mediaTypeFilter;

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => j.tags?.includes(tag));

      const matchesBeats =
        selectedBeats.length === 0 ||
        selectedBeats.every((beat) => j.beat?.includes(beat));

      return matchesSearch && matchesType && matchesTags && matchesBeats;
    });

    const sorted = sortCol
      ? [...list].sort((a, b) => {
          let valA: string | number | null = null;
          let valB: string | number | null = null;

          if (sortCol === 'name') {
            valA = `${a.last_name} ${a.first_name}`.toLowerCase();
            valB = `${b.last_name} ${b.first_name}`.toLowerCase();
          } else if (sortCol === 'media') {
            valA = (a.media_outlet ?? '').toLowerCase();
            valB = (b.media_outlet ?? '').toLowerCase();
          } else if (sortCol === 'type') {
            valA = a.media_type ?? '';
            valB = b.media_type ?? '';
          } else if (sortCol === 'score') {
            valA = a.quality_score ?? -1;
            valB = b.quality_score ?? -1;
          } else if (sortCol === 'last_contacted') {
            valA = a.last_contacted_at ?? '';
            valB = b.last_contacted_at ?? '';
          }

          if (valA === null || valA === '') return 1;
          if (valB === null || valB === '') return -1;
          if (valA < valB) return sortDir === 'asc' ? -1 : 1;
          if (valA > valB) return sortDir === 'asc' ? 1 : -1;
          return 0;
        })
      : list;

    // Always push journalists without email to the bottom
    return sorted.sort((a, b) => {
      const aHas = !!a.email?.trim();
      const bHas = !!b.email?.trim();
      if (aHas === bHas) return 0;
      return aHas ? -1 : 1;
    });
  }, [journalists, search, mediaTypeFilter, selectedTags, selectedBeats, sortCol, sortDir]);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-hpr-gold" />
      : <ArrowDown className="h-3 w-3 ml-1 text-hpr-gold" />;
  };

  // Reset visible count when filters change
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, mediaTypeFilter, selectedTags, selectedBeats, sortCol, sortDir]);

  // IntersectionObserver for infinite scroll
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length]);

  const paginated = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Selection helpers
  const allPageSelected = paginated.length > 0 && paginated.every((j) => selectedIds.has(j.id));
  const somePageSelected = paginated.some((j) => selectedIds.has(j.id)) && !allPageSelected;

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected;
    }
  }, [somePageSelected]);

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((j) => next.delete(j.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((j) => next.add(j.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkValidate = async () => {
    setIsBulkLoading(true);
    try {
      const result = await bulkAddTagAction(Array.from(selectedIds), 'validate');
      if (result.success) {
        toast({
          title: 'Emails vérifiés',
          description: `${result.updated} journaliste${result.updated !== 1 ? 's' : ''} marqué${result.updated !== 1 ? 's' : ''} comme vérifié${result.updated !== 1 ? 's' : ''}.`,
        });
        setSelectedIds(new Set());
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleEdit = (journalist: JournalistRow) => {
    setEditingJournalist(journalist);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tCommon('confirmDelete'))) return;
    setDeletingId(id);
    try {
      const result = await deleteJournalistAction(id);
      if (result.success) {
        toast({ title: tCommon('success'), description: 'Journaliste supprimé.', variant: 'default' });
      } else {
        toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const mediaTypes = [
    'presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'influenceur',
  ] as const;

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${tCommon('search')} journalistes...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
          />
        </div>
        <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
          <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/[0.08]">
            <SelectValue placeholder="Type de média" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon('all')} les types</SelectItem>
            {mediaTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`media_types.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-9 gap-1.5 bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] ${selectedTags.length > 0 ? 'border-hpr-gold/40 text-hpr-gold' : 'text-muted-foreground'}`}
              >
                <Tag className="h-3.5 w-3.5" />
                Tags
                {selectedTags.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-hpr-gold/20 px-1.5 py-0.5 text-xs font-medium text-hpr-gold">
                    {selectedTags.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground mb-1">Filtrer par tag</p>
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {allTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                      className={`w-full flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors ${
                        isSelected
                          ? 'bg-hpr-gold/10 text-hpr-gold'
                          : 'text-foreground/80 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="truncate">{tag}</span>
                      {isSelected && <X className="h-3 w-3 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="mt-2 w-full rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors text-left"
                >
                  Effacer les filtres
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Beat filter */}
        {allBeats.length > 0 && (
          <Popover open={beatPopoverOpen} onOpenChange={setBeatPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-9 gap-1.5 bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] ${selectedBeats.length > 0 ? 'border-hpr-gold/40 text-hpr-gold' : 'text-muted-foreground'}`}
              >
                <Layers className="h-3.5 w-3.5" />
                Thématiques
                {selectedBeats.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-hpr-gold/20 px-1.5 py-0.5 text-xs font-medium text-hpr-gold">
                    {selectedBeats.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground mb-1">Filtrer par thématique</p>
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {allBeats.map((beat) => {
                  const isSelected = selectedBeats.includes(beat);
                  return (
                    <button
                      key={beat}
                      onClick={() =>
                        setSelectedBeats((prev) =>
                          isSelected ? prev.filter((b) => b !== beat) : [...prev, beat]
                        )
                      }
                      className={`w-full flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors ${
                        isSelected
                          ? 'bg-hpr-gold/10 text-hpr-gold'
                          : 'text-foreground/80 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="truncate">{beat}</span>
                      {isSelected && <X className="h-3 w-3 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
              {selectedBeats.length > 0 && (
                <button
                  onClick={() => setSelectedBeats([])}
                  className="mt-2 w-full rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors text-left"
                >
                  Effacer les filtres
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Active tag chips */}
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-hpr-gold/10 px-2.5 py-0.5 text-xs text-hpr-gold border border-hpr-gold/20"
          >
            {tag}
            <button
              onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
              className="hover:text-hpr-gold/60"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Active beat chips */}
        {selectedBeats.map((beat) => (
          <span
            key={beat}
            className="inline-flex items-center gap-1 rounded-full bg-hpr-gold/10 px-2.5 py-0.5 text-xs text-hpr-gold border border-hpr-gold/20"
          >
            {beat}
            <button
              onClick={() => setSelectedBeats((prev) => prev.filter((b) => b !== beat))}
              className="hover:text-hpr-gold/60"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {(search || mediaTypeFilter !== 'all' || selectedTags.length > 0 || selectedBeats.length > 0) && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-hpr-gold/25 bg-hpr-gold/5 px-4 py-2.5">
          <span className="text-sm font-medium text-hpr-gold">
            {selectedIds.size} journaliste{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="gold"
            onClick={handleBulkValidate}
            disabled={isBulkLoading}
            className="h-8 text-xs gap-1.5"
          >
            {isBulkLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <CheckCircle2 className="h-3.5 w-3.5" />}
            Marquer comme vérifiés
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={isBulkLoading}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Annuler
          </Button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {search || mediaTypeFilter !== 'all'
              ? tCommon('noResults')
              : t('noJournalists')}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pr-0">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-white/20 cursor-pointer accent-[#B8860B]"
                    title="Tout sélectionner"
                  />
                </TableHead>
                <TableHead className="w-[220px]">
                  <button onClick={() => handleSort('name')} className="flex items-center text-xs font-medium hover:text-foreground transition-colors">
                    Nom <SortIcon col="name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('media')} className="flex items-center text-xs font-medium hover:text-foreground transition-colors">
                    Média <SortIcon col="media" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('type')} className="flex items-center text-xs font-medium hover:text-foreground transition-colors">
                    Type <SortIcon col="type" />
                  </button>
                </TableHead>
                <TableHead>Thématiques</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-center w-[100px]">
                  <button onClick={() => handleSort('score')} className="flex items-center justify-center w-full text-xs font-medium hover:text-foreground transition-colors">
                    {t('qualityScore')} <SortIcon col="score" />
                  </button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <button onClick={() => handleSort('last_contacted')} className="flex items-center text-xs font-medium hover:text-foreground transition-colors">
                    {t('lastContacted')} <SortIcon col="last_contacted" />
                  </button>
                </TableHead>
                <TableHead className="text-right w-[80px]">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((journalist) => (
                <TableRow
                  key={journalist.id}
                  className={[
                    selectedIds.has(journalist.id) ? 'bg-hpr-gold/[0.04]' : '',
                    !journalist.email?.trim() ? 'opacity-50' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <TableCell className="pr-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(journalist.id)}
                      onChange={() => toggleSelect(journalist.id)}
                      className="h-4 w-4 rounded border-white/20 cursor-pointer accent-[#B8860B]"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <JournalistInitials
                        firstName={journalist.first_name}
                        lastName={journalist.last_name}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {journalist.first_name} {journalist.last_name}
                          {journalist.is_opted_out && (
                            <span className="ml-1 text-red-400 text-xs" title="Désinscrit">STOP</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          {journalist.email}
                          {journalist.tags?.includes('validate') && (
                            <span className="text-hpr-gold leading-none" title="Email vérifié">✓</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground/80">
                      {journalist.media_outlet ?? <span className="text-muted-foreground">—</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {journalist.media_type ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${MEDIA_TYPE_COLORS[journalist.media_type] ?? 'bg-white/10 text-foreground'}`}>
                        {t(`media_types.${journalist.media_type}`)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {journalist.beat && journalist.beat.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {journalist.beat.slice(0, 2).map((b, i) => (
                          <span key={i} className="inline-flex items-center rounded-full bg-white/[0.05] px-2 py-0.5 text-xs text-foreground/70">
                            {b}
                          </span>
                        ))}
                        {journalist.beat.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{journalist.beat.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {journalist.tags && journalist.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {journalist.tags.map((tag, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.8px] font-medium ${
                              tag === 'validate'
                                ? 'bg-hpr-gold/10 text-hpr-gold border border-hpr-gold/30'
                                : tag === 'auto-source'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : tag === 'email-verified'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : tag === 'non-existent'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : tag === 'unverifiable'
                                ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                : tag === 'via-hunter'
                                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                : tag === 'email-pattern'
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-hpr-gold/10 text-hpr-gold border border-hpr-gold/20'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreBadge score={journalist.quality_score} />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {journalist.last_contacted_at
                        ? new Date(journalist.last_contacted_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEdit(journalist)}
                        title={t('editJournalist')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDelete(journalist.id)}
                        disabled={deletingId === journalist.id}
                        title={tCommon('delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Load more sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4 border-t border-white/[0.06]">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
            </div>
          )}
          {!hasMore && filtered.length > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-white/[0.06] text-center">
              <span className="text-xs text-muted-foreground">{filtered.length} journalistes affichés</span>
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <JournalistFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingJournalist(null);
        }}
        journalist={editingJournalist}
      />
    </>
  );
}
