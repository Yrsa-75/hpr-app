'use client';

import * as React from 'react';
import { Pencil } from 'lucide-react';
import { EditCampaignDialog } from '@/components/campaigns/edit-campaign-dialog';
import type { CampaignRow } from '@/types/database';

export function EditCampaignButton({ campaign }: { campaign: CampaignRow }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-white/[0.08] hover:border-white/20 rounded-lg px-3 py-1.5"
      >
        <Pencil className="h-3 w-3" />
        Modifier
      </button>
      <EditCampaignDialog campaign={campaign} open={open} onOpenChange={setOpen} />
    </>
  );
}
