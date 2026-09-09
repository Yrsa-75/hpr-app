'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { addClippingAction } from '@/app/[locale]/(dashboard)/clippings/actions';
import type { ClientOption, CampaignOption } from '@/lib/clippings/attribution-options';

const NO_COMMUNIQUE = '__none__';
const NO_SENTIMENT = '__none__';

const SOURCE_TYPES = [
  { value: 'web', label: 'Web' },
  { value: 'presse_ecrite', label: 'Presse écrite' },
  { value: 'tv', label: 'TV' },
  { value: 'radio', label: 'Radio' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'blog', label: 'Blog' },
  { value: 'social_media', label: 'Réseaux sociaux' },
] as const;

const SENTIMENTS = [
  { value: 'positive', label: 'Positif' },
  { value: 'neutral', label: 'Neutre' },
  { value: 'negative', label: 'Négatif' },
  { value: 'mixed', label: 'Mixte' },
] as const;

type SourceType = (typeof SOURCE_TYPES)[number]['value'];

interface AddClippingDialogProps {
  clientOptions: ClientOption[];
  campaignOptions: CampaignOption[];
}

export function AddClippingDialog({ clientOptions, campaignOptions }: AddClippingDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [url, setUrl] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [sourceName, setSourceName] = React.useState('');
  const [sourceType, setSourceType] = React.useState<SourceType>('web');
  const [publishedAt, setPublishedAt] = React.useState('');
  const [clientId, setClientId] = React.useState('');
  const [campaignId, setCampaignId] = React.useState(NO_COMMUNIQUE);
  const [sentiment, setSentiment] = React.useState(NO_SENTIMENT);
  const [excerpt, setExcerpt] = React.useState('');

  const campaignsForClient = campaignOptions.filter((c) => c.client_id === clientId);

  function resetForm() {
    setUrl('');
    setTitle('');
    setSourceName('');
    setSourceType('web');
    setPublishedAt('');
    setClientId('');
    setCampaignId(NO_COMMUNIQUE);
    setSentiment(NO_SENTIMENT);
    setExcerpt('');
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) resetForm();
  }

  function handleClientChange(value: string) {
    setClientId(value);
    setCampaignId(NO_COMMUNIQUE);
  }

  const canSubmit = url.trim() !== '' && title.trim() !== '' && sourceName.trim() !== '' && clientId !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await addClippingAction({
        url: url.trim(),
        title: title.trim(),
        source_name: sourceName.trim(),
        source_type: sourceType,
        published_at: publishedAt || null,
        client_id: clientId,
        campaign_id: campaignId === NO_COMMUNIQUE ? null : campaignId,
        sentiment: sentiment === NO_SENTIMENT ? null : (sentiment as 'positive' | 'neutral' | 'negative' | 'mixed'),
        excerpt: excerpt.trim() || null,
      });
      if (result.success) {
        toast({ title: 'Retombée ajoutée' });
        setOpen(false);
        router.refresh();
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => handleOpenChange(true)} className="shrink-0">
        <Plus className="h-4 w-4" />
        <span className="ml-1.5">Ajouter une retombée</span>
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une retombée</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clipping-url">URL de l&apos;article *</Label>
            <Input
              id="clipping-url"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clipping-title">Titre de l&apos;article *</Label>
            <Input
              id="clipping-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clipping-source">Média *</Label>
              <Input
                id="clipping-source"
                placeholder="Le Figaro, France Inter..."
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type de média</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clipping-date">Date de publication</Label>
              <Input
                id="clipping-date"
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sentiment</Label>
              <Select value={sentiment} onValueChange={setSentiment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SENTIMENT}>Non évalué</SelectItem>
                  {SENTIMENTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={handleClientChange}>
              <SelectTrigger>
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
            <Label>Communiqué</Label>
            <Select value={campaignId} onValueChange={setCampaignId} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un communiqué" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMMUNIQUE}>Aucun (retombée spontanée)</SelectItem>
                {campaignsForClient.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.communique ?? c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientId && campaignsForClient.length === 0 && (
              <p className="text-[11px] text-muted-foreground/60">Aucun communiqué pour ce client.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clipping-excerpt">Extrait (optionnel)</Label>
            <Textarea
              id="clipping-excerpt"
              rows={3}
              placeholder="Passage clé de l'article..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
