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
import { useToast } from '@/components/ui/use-toast';
import {
  createProspectAction,
  updateProspectAction,
} from '@/app/[locale]/(dashboard)/prospects/actions';
import type { ProspectRow } from '@/types/database';

const prospectFormSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est obligatoire'),
  last_name: z.string().min(1, 'Le nom est obligatoire'),
  company: z.string().min(1, "L'entreprise est obligatoire"),
  email: z.union([z.string().email('Email invalide'), z.literal('')]).optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  sector: z.string().optional(),
  linkedin_url: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || /^https?:\/\/.+/.test(val),
      { message: 'URL invalide (doit commencer par http:// ou https://)' }
    ),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type ProspectFormValues = z.infer<typeof prospectFormSchema>;

interface ProspectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect?: ProspectRow | null;
}

export function ProspectFormDialog({ open, onOpenChange, prospect }: ProspectFormDialogProps) {
  const t = useTranslations('prospects');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectFormSchema),
    defaultValues: {
      first_name: prospect?.first_name ?? '',
      last_name: prospect?.last_name ?? '',
      company: prospect?.company ?? '',
      email: prospect?.email ?? '',
      phone: prospect?.phone ?? '',
      role: prospect?.role ?? '',
      sector: prospect?.sector ?? '',
      linkedin_url: prospect?.linkedin_url ?? '',
      notes: prospect?.notes ?? '',
      tags: prospect?.tags?.join(', ') ?? '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        first_name: prospect?.first_name ?? '',
        last_name: prospect?.last_name ?? '',
        company: prospect?.company ?? '',
        email: prospect?.email ?? '',
        phone: prospect?.phone ?? '',
        role: prospect?.role ?? '',
        sector: prospect?.sector ?? '',
        linkedin_url: prospect?.linkedin_url ?? '',
        notes: prospect?.notes ?? '',
        tags: prospect?.tags?.join(', ') ?? '',
      });
    }
  }, [open, prospect, reset]);

  const onSubmit = async (values: ProspectFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) formData.set(key, value);
      });

      const result = prospect
        ? await updateProspectAction(prospect.id, formData)
        : await createProspectAction(formData);

      if (result.success) {
        toast({
          title: tCommon('success'),
          description: prospect ? t('editProspect') : t('addProspect'),
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
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {prospect ? t('editProspect') : t('addProspect')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Identité */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className="text-sm text-foreground/80">
                {t('firstName')} <span className="text-red-400">*</span>
              </Label>
              <Input
                id="first_name"
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
                {...register('last_name')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
              {errors.last_name && (
                <p className="text-xs text-red-400">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Entreprise */}
          <div className="space-y-1.5">
            <Label htmlFor="company" className="text-sm text-foreground/80">
              {t('company')} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="company"
              placeholder={t('companyPlaceholder')}
              {...register('company')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            {errors.company && (
              <p className="text-xs text-red-400">{errors.company.message}</p>
            )}
          </div>

          {/* Poste + Secteur */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm text-foreground/80">
                {t('role')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="role"
                placeholder={t('rolePlaceholder')}
                {...register('role')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sector" className="text-sm text-foreground/80">
                {t('sector')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="sector"
                placeholder={t('sectorPlaceholder')}
                {...register('sector')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
            </div>
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-foreground/80">
                {t('email')}
                <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
              </Label>
              <Input
                id="email"
                type="email"
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
                {...register('phone')}
                className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
              />
            </div>
          </div>

          {/* LinkedIn */}
          <div className="space-y-1.5">
            <Label htmlFor="linkedin_url" className="text-sm text-foreground/80">
              {t('linkedinUrl')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="linkedin_url"
              placeholder="https://linkedin.com/in/..."
              {...register('linkedin_url')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            {errors.linkedin_url && (
              <p className="text-xs text-red-400">{errors.linkedin_url.message}</p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-sm text-foreground/80">
              {t('tags')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="tags"
              placeholder="ex : chaud, relancé, partenaire (séparés par des virgules)"
              {...register('tags')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm text-foreground/80">
              {t('notes')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Textarea
              id="notes"
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
            <Button type="submit" variant="gold" disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon('loading')}
                </>
              ) : (
                tCommon('save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
