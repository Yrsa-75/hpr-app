'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Calendar, Mail, Eye, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignRow } from '@/types/database';

type CampaignStatus = CampaignRow['status'];

function getStatusConfig(status: CampaignStatus): { label: string; classes: string } {
  const configs: Record<CampaignStatus, { label: string; classes: string }> = {
    draft: { label: 'Brouillon', classes: 'bg-white/5 text-muted-foreground border-white/10' },
    preparing: { label: 'En préparation', classes: 'bg-blue-950/40 text-blue-400 border-blue-500/20' },
    review: { label: 'En révision', classes: 'bg-amber-950/40 text-amber-400 border-amber-500/20' },
    approved: { label: 'Approuvé', classes: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' },
    sending: { label: 'En cours d\'envoi', classes: 'bg-cyan-950/40 text-cyan-400 border-cyan-500/20' },
    active: { label: 'Actif', classes: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' },
    paused: { label: 'En pause', classes: 'bg-orange-950/40 text-orange-400 border-orange-500/20' },
    completed: { label: 'Terminé', classes: 'bg-violet-950/40 text-violet-400 border-violet-500/20' },
    archived: { label: 'Archivé', classes: 'bg-white/5 text-muted-foreground/50 border-white/5' },
  };
  return configs[status] ?? { label: status, classes: 'bg-white/5 text-muted-foreground' };
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface CampaignCardProps {
  campaign: CampaignRow;
  clientId: string;
}

export function CampaignCard({ campaign, clientId }: CampaignCardProps) {
  const locale = useLocale();
  const t = useTranslations('campaigns');

  const statusConfig = getStatusConfig(campaign.status);
  const formattedDate = formatDate(campaign.target_date);

  const href = `/${locale}/clients/${clientId}/campaigns/${campaign.id}`;

  return (
    <div className="group relative border border-white/[0.08] bg-white/[0.02] rounded-xl p-5 hover:border-white/15 hover:bg-white/[0.04] transition-all duration-200">
      <div className="space-y-4">
        {/* Header: name + status badge */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
            {campaign.name}
          </h3>
          <span
            className={cn(
              'shrink-0 inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium',
              statusConfig.classes
            )}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Description */}
        {campaign.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {campaign.description}
          </p>
        )}

        {/* Tags */}
        {campaign.tags && campaign.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {campaign.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block bg-white/5 text-muted-foreground text-xs px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
            {campaign.tags.length > 3 && (
              <span className="inline-block text-muted-foreground/60 text-xs px-1 py-0.5">
                +{campaign.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-0.5 bg-white/[0.02] rounded-lg p-2 border border-white/[0.04]">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{campaign.total_sent}</span>
            <span className="text-[12px] text-muted-foreground/70">Envoyés</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 bg-white/[0.02] rounded-lg p-2 border border-white/[0.04]">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{campaign.total_opened}</span>
            <span className="text-[12px] text-muted-foreground/70">Ouverts</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 bg-white/[0.02] rounded-lg p-2 border border-white/[0.04]">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{campaign.total_replied}</span>
            <span className="text-[12px] text-muted-foreground/70">Réponses</span>
          </div>
        </div>

        {/* Footer: date + link */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {formattedDate && (
              <>
                <Calendar className="h-3 w-3" />
                <span>{formattedDate}</span>
              </>
            )}
            {!formattedDate && (
              <span className="italic opacity-50">Pas de date cible</span>
            )}
          </div>

          <Link
            href={href}
            className="flex items-center gap-1 text-xs text-hpr-gold/70 hover:text-hpr-gold transition-colors group/link"
          >
            <span>Voir la campagne</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
