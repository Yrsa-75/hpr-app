'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

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
import { useToast } from '@/components/ui/use-toast';
import { JournalistFormDialog } from '@/components/journalists/journalist-form-dialog';
import { deleteJournalistAction } from '@/app/[locale]/(dashboard)/journalists/actions';
import type { JournalistRow } from '@/types/database';

const PAGE_SIZE = 20;

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
  const [page, setPage] = React.useState(0);
  const [editingJournalist, setEditingJournalist] = React.useState<JournalistRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    return journalists.filter((j) => {
      const matchesSearch =
        !search ||
        `${j.first_name} ${j.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        j.email.toLowerCase().includes(search.toLowerCase()) ||
        (j.media_outlet ?? '').toLowerCase().includes(search.toLowerCase());

      const matchesType =
        mediaTypeFilter === 'all' || j.media_type === mediaTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [journalists, search, mediaTypeFilter]);

  // Reset page when filter changes
  React.useEffect(() => {
    setPage(0);
  }, [search, mediaTypeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
      <div className="flex items-center gap-3">
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
        {(search || mediaTypeFilter !== 'all') && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

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
                <TableHead className="w-[220px]">Nom</TableHead>
                <TableHead>Média</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Thématiques</TableHead>
                <TableHead className="text-center w-[100px]">{t('qualityScore')}</TableHead>
                <TableHead className="w-[120px]">{t('lastContacted')}</TableHead>
                <TableHead className="text-right w-[80px]">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((journalist) => (
                <TableRow key={journalist.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <JournalistInitials
                        firstName={journalist.first_name}
                        lastName={journalist.last_name}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {journalist.first_name} {journalist.last_name}
                          {journalist.is_verified && (
                            <span className="ml-1 text-hpr-gold" title="Vérifié">✓</span>
                          )}
                          {journalist.is_opted_out && (
                            <span className="ml-1 text-red-400 text-xs" title="Désinscrit">STOP</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{journalist.email}</p>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <span className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {tCommon('of')} {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
