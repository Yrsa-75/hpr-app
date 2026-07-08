'use client';

import * as React from 'react';
import { FileText, Building2, Pencil, Loader2, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { attributeClippingAction } from '@/app/[locale]/(dashboard)/clippings/actions';
import type { ClientOption, CampaignOption } from '@/lib/clippings/attribution-options';

const NO_COMMUNIQUE = '__none__';

interface ClippingAttributionProps {
  clippingId: string;
  clientId: string | null;
  campaignId: string | null;
  clientOptions: ClientOption[];
  campaignOptions: CampaignOption[];
}

export function ClippingAttribution({
  clippingId,
  clientId,
  campaignId,
  clientOptions,
  campaignOptions,
}: ClippingAttributionProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<string>(clientId ?? '');
  const [selectedCampaign, setSelectedCampaign] = React.useState<string>(
    campaignId ?? NO_COMMUNIQUE
  );

  // Communiqués disponibles pour le client sélectionné
  const campaignsForClient = campaignOptions.filter((c) => c.client_id === selectedClient);

  const clientName = clientOptions.find((c) => c.id === clientId)?.name ?? '—';
  const currentCampaign = campaignOptions.find((c) => c.id === campaignId);
  const communiqueLabel = currentCampaign
    ? currentCampaign.communique ?? currentCampaign.name
    : null;

  function handleClientChange(value: string) {
    setSelectedClient(value);
    // Le communiqué courant n'appartient probablement plus au nouveau client → on réinitialise.
    setSelectedCampaign(NO_COMMUNIQUE);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const campaignValue = selectedCampaign === NO_COMMUNIQUE ? null : selectedCampaign;
      const result = await attributeClippingAction(clippingId, selectedClient, campaignValue);
      if (result.success) {
        toast({ title: 'Attribution mise à jour' });
        setOpen(false);
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      {/* Client */}
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Building2 className="h-3 w-3 shrink-0" />
        {clientName}
      </span>
      <span className="text-muted-foreground/40">·</span>
      {/* Communiqué */}
      <span className="inline-flex items-center gap-1">
        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
        {communiqueLabel ? (
          <span className="text-muted-foreground line-clamp-1 max-w-[280px]">{communiqueLabel}</span>
        ) : (
          <span className="text-muted-foreground/60 italic">Retombée spontanée (hors communiqué)</span>
        )}
      </span>

      {/* Éditeur */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-muted-foreground/60 hover:text-hpr-gold transition-colors"
            aria-label="Modifier l'attribution"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Client</label>
            <Select value={selectedClient} onValueChange={handleClientChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Choisir un client" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Communiqué</label>
            <Select
              value={selectedCampaign}
              onValueChange={setSelectedCampaign}
              disabled={!selectedClient}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Choisir un communiqué" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMMUNIQUE}>
                  Aucun — retombée spontanée
                </SelectItem>
                {campaignsForClient.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.communique ?? c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClient && campaignsForClient.length === 0 && (
              <p className="text-[11px] text-muted-foreground/60">
                Aucun communiqué pour ce client.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="h-8 text-xs"
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !selectedClient}
              className="h-8 text-xs"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              <span className="ml-1">Enregistrer</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
