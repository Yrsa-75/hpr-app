'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

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
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  createJournalistAction,
  updateJournalistAction,
} from '@/app/[locale]/(dashboard)/journalists/actions';
import type { JournalistRow } from '@/types/database';

const journalistFormSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est obligatoire'),
  last_name: z.string().min(1, 'Le nom est obligatoire'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  media_outlet: z.string().optional(),
  media_type: z
    .enum(['presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'influenceur', 'none'])
    .optional(),
  beat: z.string().optional(),
  location: z.string().optional(),
  linkedin_url: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        val === '' ||
        /^https?:\/\/.+/.test(val),
      { message: 'URL invalide (doit commencer par http:// ou https://)' }
    ),
  twitter_handle: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type JournalistFormValues = z.infer<typeof journalistFormSchema>;

interface JournalistFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalist?: JournalistRow | null;
}

const MEDIA_TYPES = [
  'presse_ecrite',
  'tv',
  'radio',
  'web',
  'podcast',
  'blog',
  'influenceur',
] as const;

export function JournalistFormDialog({
  open,
  onOpenChange,
  journalist,
}: JournalistFormDialogProps) {
  const t = useTranslations('journalists');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isEditing = Boolean(journalist);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JournalistFormValues>({
    resolver: zodResolver(journalistFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      media_outlet: '',
      media_type: 'none',
      beat: '',
      location: '',
      linkedin_url: '',
      twitter_handle: '',
      notes: '',
      tags: '',
    },
  });

  const mediaTypeValue = watch('media_type');

  React.useEffect(() => {
    if (open) {
      reset({
        first_name: journalist?.first_name ?? '',
        last_name: journalist?.last_name ?? '',
        email: journalist?.email ?? '',
        phone: journalist?.phone ?? '',
        media_outlet: journalist?.media_outlet ?? '',
        media_type: journalist?.media_type ?? 'none',
        beat: journalist?.beat?.join(', ') ?? '',
        location: journalist?.location ?? '',
        linkedin_url: journalist?.linkedin_url ?? '',
        twitter_handle: journalist?.twitter_handle ?? '',
        notes: journalist?.notes ?? '',
        tags: journalist?.tags?.join(', ') ?? '',
      });
    }
  }, [open, journalist, reset]);

  const onSubmit = async (values: JournalistFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        // 'none' is the UI placeholder for optional selects — skip it
        if (value !== undefined && value !== null && value !== 'none') {
          formData.set(key, String(value));
        }
      });

      const result =
        isEditing && journalist
          ? await updateJournalistAction(journalist.id, formData)
          : await createJournalistAction(formData);

      if (result.success) {
        toast({
          title: tCommon('success'),
          description: isEditing
            ? 'Journaliste mis à jour avec succès.'
            : 'Journaliste ajouté avec succès.',
          variant: 'default',
        });
        onOpenChange(false);
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
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEditing ? t('editJournalist') : t('addJournalist')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Row 1: Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className="text-sm text-foreground/80">
                {t('firstName')} <span className="text-red-400">*</span>
              </Label>
              <Input
                id="first_name"
                placeholder="ex : Marie"
                {...register('first_name')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
              {errors.first_name && (
                <p className="text-xs text-red-400">{errors.first_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name" className="text-sm text-foreground/80">
                {t('lastName')} <span className="text-red-400">*</span>
              </Label>
              <Input
                id="last_name"
                placeholder="ex : Dupont"
                {...register('last_name')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
              {errors.last_name && (
                <p className="text-xs text-red-400">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Row 2: Email + Téléphone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-foreground/80">
                {t('email')} <span className="text-red-400">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ex : marie@lemonde.fr"
                {...register('email')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm text-foreground/80">
                {t('phone')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="ex : +33 6 00 00 00 00"
                {...register('phone')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
            </div>
          </div>

          {/* Row 3: Média + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="media_outlet" className="text-sm text-foreground/80">
                {t('mediaOutlet')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="media_outlet"
                placeholder="ex : Le Monde, BFM TV..."
                {...register('media_outlet')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground/80">
                {t('mediaType')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Select
                value={mediaTypeValue ?? ''}
                onValueChange={(val) =>
                  setValue(
                    'media_type',
                    val as JournalistFormValues['media_type']
                  )
                }
              >
                <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {MEDIA_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`media_types.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Thématiques + Localisation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="beat" className="text-sm text-foreground/80">
                {t('beat')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="beat"
                placeholder="ex : Tech, Santé, Culture"
                {...register('beat')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
              <p className="text-xs text-muted-foreground">Séparées par des virgules</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-sm text-foreground/80">
                {t('location')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="location"
                placeholder="ex : Paris, Lyon, Bordeaux..."
                {...register('location')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
            </div>
          </div>

          {/* Row 5: LinkedIn + Twitter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="linkedin_url" className="text-sm text-foreground/80">
                LinkedIn URL
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="linkedin_url"
                type="url"
                placeholder="https://linkedin.com/in/..."
                {...register('linkedin_url')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
              {errors.linkedin_url && (
                <p className="text-xs text-red-400">{errors.linkedin_url.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="twitter_handle" className="text-sm text-foreground/80">
                Twitter/X (@handle)
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="twitter_handle"
                placeholder="ex : @mariedupont"
                {...register('twitter_handle')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
            </div>
          </div>

          {/* Row 6: Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-sm text-foreground/80">
              {t('tags')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="tags"
              placeholder="ex : VIP, Partenaire, Potentiel"
              {...register('tags')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            <p className="text-xs text-muted-foreground">Séparés par des virgules</p>
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3 pt-1">
            <Separator className="flex-1 bg-white/[0.06]" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Notes internes</span>
            <Separator className="flex-1 bg-white/[0.06]" />
          </div>

          {/* Row 7: Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm text-foreground/80">
              {t('notes')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Notes privées sur ce journaliste..."
              rows={3}
              {...register('notes')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 resize-none"
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
              ) : isEditing ? (
                tCommon('save')
              ) : (
                t('addJournalist')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
