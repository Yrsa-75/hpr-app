'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Loader2, UserSearch, Target } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createCampaignAction } from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/actions';

const campaignFormSchema = z.object({
  name: z.string().min(1, 'Ce champ est obligatoire').max(200),
  description: z.string().optional(),
  campaign_type: z.enum(['journalists', 'prospects']).default('journalists'),
  target_date: z.string().optional(),
  tags: z.string().optional(),
  keywords: z.string().optional(),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function defaultDescription(clientName?: string) {
  const now = new Date();
  const month = MONTHS_FR[now.getMonth()];
  const year = now.getFullYear();
  return clientName ? `Communiqué de Presse ${month} ${year} - ${clientName}` : '';
}

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
}

export function CampaignFormDialog({ open, onOpenChange, clientId, clientName }: CampaignFormDialogProps) {
  const t = useTranslations('campaigns');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: '',
      description: defaultDescription(clientName),
      campaign_type: 'journalists' as const,
      target_date: '',
      tags: '',
      keywords: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: '',
        description: defaultDescription(clientName),
        campaign_type: 'journalists',
        target_date: '',
        tags: '',
        keywords: '',
      });
    }
  }, [open, reset, clientName]);

  const onSubmit = async (values: CampaignFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          formData.set(key, value);
        }
      });

      const result = await createCampaignAction(clientId, formData);

      if (result.success && result.campaignId) {
        toast({
          title: tCommon('success'),
          description: t('createCampaign'),
        });
        onOpenChange(false);
        router.push(`/${locale}/clients/${clientId}/campaigns/${result.campaignId}`);
      } else {
        toast({
          title: tCommon('error'),
          description: result.error ?? 'Une erreur s\'est produite.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {t('createCampaign')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Nom de la campagne */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-foreground/80">
              {t('campaignName')} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              placeholder="ex : Lancement produit Q1 2026"
              {...register('name')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            {errors.name && (
              <p className="text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          {/* Type de campagne */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground/80">
              Type de campagne <span className="text-red-400">*</span>
            </Label>
            <Controller
              name="campaign_type"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'journalists', label: 'Journalistes', description: 'Relations presse classiques', Icon: UserSearch },
                    { value: 'prospects', label: 'Prospects comm', description: 'Démarchage dir. comm / marketing', Icon: Target },
                  ].map(({ value, label, description, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        field.value === value
                          ? 'border-hpr-gold/50 bg-hpr-gold/5 text-foreground'
                          : 'border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground'
                      }`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${field.value === value ? 'text-hpr-gold' : ''}`} />
                      <div>
                        <p className="text-xs font-medium">{label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm text-foreground/80">
              {t('description')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Décrivez les objectifs de cette campagne..."
              rows={3}
              {...register('description')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 resize-none"
            />
          </div>

          {/* Date cible */}
          <div className="space-y-1.5">
            <Label htmlFor="target_date" className="text-sm text-foreground/80">
              {t('targetDate')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="target_date"
              type="date"
              {...register('target_date')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-sm text-foreground/80">
              {t('tags')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="tags"
              placeholder="ex : tech, B2B, startup (séparés par des virgules)"
              {...register('tags')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          {/* Mots-clés */}
          <div className="space-y-1.5">
            <Label htmlFor="keywords" className="text-sm text-foreground/80">
              {t('keywords')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="keywords"
              placeholder="ex : intelligence artificielle, SaaS, innovation (séparés par des virgules)"
              {...register('keywords')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-muted-foreground hover:text-foreground"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              variant="gold"
              disabled={isSubmitting}
              className="min-w-[160px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon('loading')}
                </>
              ) : (
                t('createCampaign')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
