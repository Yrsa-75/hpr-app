'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { updateCampaignAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/actions';
import type { CampaignRow } from '@/types/database';

const schema = z.object({
  name: z.string().min(1, 'Ce champ est obligatoire').max(200),
  description: z.string().optional(),
  target_date: z.string().optional(),
  tags: z.string().optional(),
  keywords: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditCampaignDialogProps {
  campaign: CampaignRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCampaignDialog({ campaign, open, onOpenChange }: EditCampaignDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: campaign.name,
      description: campaign.description ?? '',
      target_date: campaign.target_date ?? '',
      tags: (campaign.tags ?? []).join(', '),
      keywords: (campaign.keywords ?? []).join(', '),
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: campaign.name,
        description: campaign.description ?? '',
        target_date: campaign.target_date ?? '',
        tags: (campaign.tags ?? []).join(', '),
        keywords: (campaign.keywords ?? []).join(', '),
      });
    }
  }, [open, campaign, reset]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const result = await updateCampaignAction(campaign.id, values);
      if (result.success) {
        toast({ title: 'Campagne mise à jour' });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Modifier la campagne</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-foreground/80">
              Nom <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm text-foreground/80">
              Description <span className="ml-1.5 text-xs text-muted-foreground">(optionnel)</span>
            </Label>
            <Textarea
              id="description"
              rows={3}
              {...register('description')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target_date" className="text-sm text-foreground/80">
              Date cible <span className="ml-1.5 text-xs text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              id="target_date"
              type="date"
              {...register('target_date')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-sm text-foreground/80">
              Tags <span className="ml-1.5 text-xs text-muted-foreground">(séparés par des virgules)</span>
            </Label>
            <Input
              id="tags"
              placeholder="ex : tech, B2B, startup"
              {...register('tags')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keywords" className="text-sm text-foreground/80">
              Mots-clés Google News <span className="ml-1.5 text-xs text-muted-foreground">(séparés par des virgules)</span>
            </Label>
            <Input
              id="keywords"
              placeholder="ex : intelligence artificielle, SaaS, Lifestick"
              {...register('keywords')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            <p className="text-xs text-muted-foreground/60">
              Utilisés pour la surveillance automatique des retombées presse.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="text-muted-foreground hover:text-foreground">
              Annuler
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
