'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';
import { deleteClientAction } from '@/app/[locale]/(dashboard)/clients/actions';
import type { ClientRow } from '@/types/database';

// Deterministic color from client name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-900/60',
    'bg-violet-900/60',
    'bg-emerald-900/60',
    'bg-rose-900/60',
    'bg-amber-900/60',
    'bg-cyan-900/60',
    'bg-indigo-900/60',
    'bg-teal-900/60',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface ClientCardProps {
  client: ClientRow;
  campaignCount?: number;
}

export function ClientCard({ client, campaignCount = 0 }: ClientCardProps) {
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const initials = getInitials(client.name);
  const avatarColor = getAvatarColor(client.name);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteClientAction(client.id);
      if (result.success) {
        toast({
          title: tCommon('success'),
          description: t('deleteClient'),
        });
        setDeleteOpen(false);
      } else {
        toast({
          title: tCommon('error'),
          description: result.error ?? 'Une erreur s\'est produite.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/${locale}/clients/${client.id}`)}
        onKeyDown={(e) => e.key === 'Enter' && router.push(`/${locale}/clients/${client.id}`)}
        className="cursor-pointer group relative border border-white/[0.08] bg-white/[0.02] rounded-xl p-5 hover:border-white/15 hover:bg-white/[0.04] transition-all duration-200"
      >
        {/* Actions dropdown */}
        <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{tCommon('moreOptions')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40 bg-[#0F0F10] border-white/[0.08]"
            >
              <DropdownMenuItem
                onClick={() => setEditOpen(true)}
                className="cursor-pointer text-sm focus:bg-white/[0.06] focus:text-foreground"
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                {tCommon('edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="cursor-pointer text-sm text-red-400 focus:bg-red-950/30 focus:text-red-400"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {tCommon('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card content */}
        <div className="space-y-4">
          {/* Header: avatar + name */}
          <div className="flex items-start gap-3 pr-8">
            {client.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logo_url}
                alt={client.name}
                className="max-w-[100px] w-auto h-auto max-h-12 object-contain flex-shrink-0"
              />
            ) : (
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${avatarColor}`}
              >
                <span className="text-sm font-semibold text-white/90">
                  {initials}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
                {client.name}
              </h3>
              {client.industry && (
                <span className="inline-block mt-1 bg-white/5 text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                  {client.industry}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {client.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {client.description}
            </p>
          )}

          {/* Footer: website + campaigns + date */}
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{campaignCount} {t('campaigns')}</span>

              {/* Website link */}
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-hpr-gold transition-colors"
                  onClick={(e) => { e.stopPropagation(); }}
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Site</span>
                </a>
              )}
            </div>

            <span className="text-xs text-muted-foreground/60">
              {formatDate(client.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
      />

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display">{t('deleteClient')}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
              {tCommon('confirmDelete')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="text-muted-foreground hover:text-foreground"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? tCommon('loading') : tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
