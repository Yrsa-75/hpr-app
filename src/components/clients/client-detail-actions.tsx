'use client';

import * as React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';
import { CampaignFormDialog } from '@/components/campaigns/campaign-form-dialog';
import type { ClientRow } from '@/types/database';

interface ClientDetailActionsProps {
  client: ClientRow | null;
  clientId: string;
  clientName?: string;
  showNewCampaign: boolean;
}

export function ClientDetailActions({ client, clientId, clientName, showNewCampaign }: ClientDetailActionsProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [newCampaignOpen, setNewCampaignOpen] = React.useState(false);

  if (showNewCampaign) {
    return (
      <>
        <Button
          variant="gold"
          size="sm"
          onClick={() => setNewCampaignOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle campagne
        </Button>

        <CampaignFormDialog
          open={newCampaignOpen}
          onOpenChange={setNewCampaignOpen}
          clientId={clientId}
          clientName={clientName}
        />
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditOpen(true)}
        className="border-white/[0.08] hover:border-white/20 text-muted-foreground hover:text-foreground"
      >
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Modifier
      </Button>

      {client && (
        <ClientFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          client={client}
        />
      )}
    </>
  );
}
