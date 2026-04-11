'use client';

import * as React from 'react';
import { Newspaper, ExternalLink, CheckCircle, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { verifyClippingAction, deleteClippingAction } from '@/app/[locale]/(dashboard)/clippings/actions';
import type { ClippingWithJoins } from '@/app/[locale]/(dashboard)/clippings/page';

const SENTIMENT_CONFIG = {
  positive: { label: 'Positif', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  neutral: { label: 'Neutre', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  negative: { label: 'Négatif', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  mixed: { label: 'Mixte', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
} as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function ClippingCard({ clipping }: { clipping: ClippingWithJoins }) {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  const sentimentCfg = clipping.sentiment ? SENTIMENT_CONFIG[clipping.sentiment] : null;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyClippingAction(clipping.id);
      if (result.success) {
        toast({ title: 'Retombée validée' });
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteClippingAction(clipping.id);
      if (result.success) {
        setHidden(true);
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
        setIsDeleting(false);
      }
    } catch {
      setIsDeleting(false);
    }
  };

  if (hidden) return null;

  return (
    <div className={`rounded-xl border bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] ${
      clipping.is_verified ? 'border-white/[0.08]' : 'border-amber-500/20'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            {!clipping.is_verified && (
              <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                À valider
              </span>
            )}
            {clipping.detection_method === 'google_news' && (
              <span className="text-[12px] text-muted-foreground/60">Google News</span>
            )}
            {sentimentCfg && (
              <span className={`text-[12px] px-1.5 py-0 rounded border ${sentimentCfg.bg} ${sentimentCfg.color}`}>
                {sentimentCfg.label}
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={clipping.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-1.5 hover:text-hpr-gold transition-colors"
          >
            <h3 className="text-sm font-semibold text-foreground group-hover:text-hpr-gold leading-snug">
              {clipping.title}
            </h3>
            <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground group-hover:text-hpr-gold" />
          </a>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">{clipping.source_name}</span>
            <span>·</span>
            <span>{formatDate(clipping.published_at)}</span>
            {clipping.clients?.name && (
              <>
                <span>·</span>
                <span>{clipping.clients.name}</span>
              </>
            )}
            {clipping.campaigns?.name && (
              <>
                <span>·</span>
                <span className="text-muted-foreground/60">{clipping.campaigns.name}</span>
              </>
            )}
          </div>

          {/* AI summary or excerpt */}
          {(clipping.ai_summary || clipping.excerpt) && (
            <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
              {clipping.ai_summary || clipping.excerpt}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {!clipping.is_verified && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleVerify}
              disabled={isVerifying}
              className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2"
            >
              {isVerifying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              <span className="ml-1">Valider</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-7 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 px-2"
          >
            {isDeleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            <span className="ml-1">Rejeter</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ClippingsViewProps {
  clippings: ClippingWithJoins[];
}

export function ClippingsView({ clippings }: ClippingsViewProps) {
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'verified'>('all');

  const filtered = clippings.filter((c) => {
    if (filter === 'pending') return !c.is_verified;
    if (filter === 'verified') return c.is_verified;
    return true;
  });

  const pendingCount = clippings.filter((c) => !c.is_verified).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Retombées presse</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" />
            Surveillance Google News automatique à chaque visite
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-display text-hpr-gold">{clippings.length}</p>
          <p className="text-xs text-muted-foreground">retombées trouvées</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1">
        {([
          { key: 'all', label: 'Toutes' },
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

      {/* Clippings list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <Newspaper className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display text-sm font-medium text-foreground mb-1">
            {filter === 'pending' ? 'Aucune retombée à valider' : 'Aucune retombée trouvée'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {filter === 'all'
              ? 'La surveillance Google News se lance automatiquement. Les retombées apparaîtront ici dès qu\'elles sont détectées.'
              : 'Revenez après la prochaine surveillance automatique.'}
          </p>
        </div>
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
