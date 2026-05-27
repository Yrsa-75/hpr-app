'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search, Pencil, Trash2, Loader2, X, CheckCircle2, ExternalLink } from 'lucide-react';

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { ProspectFormDialog } from '@/components/prospects/prospect-form-dialog';
import { deleteProspectAction } from '@/app/[locale]/(dashboard)/prospects/actions';
import type { ProspectRow } from '@/types/database';

const PAGE_SIZE = 50;

function ProspectInitials({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-hpr-gold/10 border border-hpr-gold/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-medium text-hpr-gold">{initials}</span>
    </div>
  );
}

interface ProspectsTableProps {
  prospects: ProspectRow[];
}

export function ProspectsTable({ prospects }: ProspectsTableProps) {
  const t = useTranslations('prospects');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [search, setSearch] = React.useState('');
  const [selectedSectors, setSelectedSectors] = React.useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editTarget, setEditTarget] = React.useState<ProspectRow | null>(null);
  const [displayCount, setDisplayCount] = React.useState(PAGE_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const allSectors = React.useMemo(() => {
    const s = new Set<string>();
    prospects.forEach((p) => { if (p.sector) s.add(p.sector); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [prospects]);

  const allTags = React.useMemo(() => {
    const s = new Set<string>();
    const systemTags = new Set(['validate', 'via-hunter', 'email-verified', 'email-bounced', 'email-risky', 'email-unverifiable', 'hunter-tried']);
    prospects.forEach((p) =>
      (p.tags ?? []).forEach((tag) => {
        if (!systemTags.has(tag)) s.add(tag);
      })
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [prospects]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return prospects.filter((p) => {
      if (
        q &&
        !(
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          (p.role ?? '').toLowerCase().includes(q) ||
          (p.sector ?? '').toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q)
        )
      )
        return false;
      if (selectedSectors.size > 0 && !selectedSectors.has(p.sector ?? '')) return false;
      if (selectedTags.size > 0 && !(p.tags ?? []).some((tag) => selectedTags.has(tag))) return false;
      return true;
    });
  }, [prospects, search, selectedSectors, selectedTags]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [search, selectedSectors, selectedTags]);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setDisplayCount((n) => n + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(tCommon('confirmDelete'))) return;
    setDeletingId(id);
    try {
      const result = await deleteProspectAction(id);
      if (result.success) {
        toast({ title: tCommon('success'), description: `${name} supprimé.` });
      } else {
        toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  function toggleSector(s: string) {
    setSelectedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  const hasActiveFilters = selectedSectors.size > 0 || selectedTags.size > 0;

  return (
    <>
      {/* Barre de recherche + filtres */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un prospect, une entreprise, un poste..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/[0.03] border-white/[0.08] text-sm h-9"
            />
          </div>

          {/* Filtre secteurs */}
          {allSectors.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 border-white/[0.08] ${selectedSectors.size > 0 ? 'border-hpr-gold/40 text-hpr-gold bg-hpr-gold/5' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Secteurs {selectedSectors.size > 0 && `(${selectedSectors.size})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-2" align="start">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Secteurs</p>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {allSectors.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSector(s)}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border transition-colors ${
                        selectedSectors.has(s)
                          ? 'bg-hpr-gold/15 border-hpr-gold/40 text-hpr-gold'
                          : 'bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Filtre tags */}
          {allTags.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 border-white/[0.08] ${selectedTags.size > 0 ? 'border-hpr-gold/40 text-hpr-gold bg-hpr-gold/5' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Tags {selectedTags.size > 0 && `(${selectedTags.size})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-2" align="start">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</p>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border transition-colors ${
                        selectedTags.has(tag)
                          ? 'bg-hpr-gold/15 border-hpr-gold/40 text-hpr-gold'
                          : 'bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {hasActiveFilters && (
            <button
              onClick={() => { setSelectedSectors(new Set()); setSelectedTags(new Set()); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Effacer
            </button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} / {prospects.length}
          </span>
        </div>

        {/* Chips filtres actifs */}
        {(selectedSectors.size > 0 || selectedTags.size > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {Array.from(selectedSectors).map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs bg-hpr-gold/10 text-hpr-gold border border-hpr-gold/20 px-2 py-0.5 rounded-full">
                {s}
                <button onClick={() => toggleSector(s)}><X className="h-2.5 w-2.5" /></button>
              </span>
            ))}
            {Array.from(selectedTags).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 text-xs bg-white/5 text-muted-foreground border border-white/10 px-2 py-0.5 rounded-full">
                {tag}
                <button onClick={() => toggleTag(tag)}><X className="h-2.5 w-2.5" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs font-medium w-10"></TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Prospect</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Entreprise</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Email</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Tags</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                  {tCommon('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              displayed.map((prospect) => {
                const isVerified =
                  prospect.email &&
                  (prospect.tags?.includes('validate') ||
                    prospect.tags?.includes('via-hunter') ||
                    prospect.tags?.includes('email-verified'));
                const isDeleting = deletingId === prospect.id;
                const displayTags = (prospect.tags ?? []).filter(
                  (tag) =>
                    !['validate', 'via-hunter', 'email-verified', 'email-bounced', 'email-risky', 'email-unverifiable', 'hunter-tried'].includes(tag)
                );

                return (
                  <TableRow
                    key={prospect.id}
                    className="border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <TableCell>
                      <ProspectInitials firstName={prospect.first_name} lastName={prospect.last_name} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {prospect.first_name} {prospect.last_name}
                          {prospect.is_opted_out && (
                            <span className="ml-2 text-xs text-orange-400">(désinscrit)</span>
                          )}
                        </p>
                        {prospect.role && (
                          <p className="text-xs text-muted-foreground mt-0.5">{prospect.role}</p>
                        )}
                        {prospect.sector && (
                          <span className="inline-block mt-1 text-xs bg-hpr-gold/8 text-hpr-gold/80 border border-hpr-gold/15 px-1.5 py-0 rounded">
                            {prospect.sector}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-foreground">{prospect.company}</span>
                        {prospect.linkedin_url && (
                          <a
                            href={prospect.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {prospect.email ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{prospect.email}</span>
                          {isVerified && (
                            <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                          )}
                          {prospect.tags?.includes('email-bounced') && (
                            <span className="text-xs text-red-400">bounced</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {displayTags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 bg-white/5 text-muted-foreground border-white/10">
                            {tag}
                          </Badge>
                        ))}
                        {displayTags.length > 3 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-white/5 text-muted-foreground border-white/10">
                            +{displayTags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditTarget(prospect)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-400"
                          disabled={isDeleting}
                          onClick={() =>
                            handleDelete(prospect.id, `${prospect.first_name} ${prospect.last_name}`)
                          }
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sentinel infinite scroll */}
      <div ref={sentinelRef} className="h-4" />

      {/* Dialog édition */}
      <ProspectFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        prospect={editTarget}
      />
    </>
  );
}
