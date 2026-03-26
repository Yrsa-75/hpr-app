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
import { createClientAction, updateClientAction } from '@/app/[locale]/(dashboard)/clients/actions';
import type { ClientRow } from '@/types/database';

const clientFormSchema = z.object({
  name: z.string().min(1, 'Ce champ est obligatoire').max(100),
  industry: z.string().optional(),
  website: z
    .string()
    .optional()
    .refine((val) => !val || val === '' || /^https?:\/\/.+/.test(val), {
      message: 'URL invalide (doit commencer par http:// ou https://)',
    }),
  description: z.string().optional(),
  sender_name: z.string().optional(),
  sender_email: z
    .string()
    .optional()
    .refine((val) => !val || val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Email invalide',
    }),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRow | null;
}

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isEditing = Boolean(client);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client?.name ?? '',
      industry: client?.industry ?? '',
      website: client?.website ?? '',
      description: client?.description ?? '',
      sender_name: client?.sender_name ?? '',
      sender_email: client?.sender_email ?? '',
    },
  });

  // Reset form when dialog opens/closes or client changes
  React.useEffect(() => {
    if (open) {
      reset({
        name: client?.name ?? '',
        industry: client?.industry ?? '',
        website: client?.website ?? '',
        description: client?.description ?? '',
        sender_name: client?.sender_name ?? '',
        sender_email: client?.sender_email ?? '',
      });
    }
  }, [open, client, reset]);

  const onSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.set(key, value);
        }
      });

      const result = isEditing && client
        ? await updateClientAction(client.id, formData)
        : await createClientAction(formData);

      if (result.success) {
        toast({
          title: tCommon('success'),
          description: isEditing ? t('editClient') : t('addClient'),
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
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEditing ? t('editClient') : t('addClient')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Nom du client */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-foreground/80">
              {t('clientName')} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              placeholder="ex : Acme Corporation"
              {...register('name')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            {errors.name && (
              <p className="text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          {/* Secteur */}
          <div className="space-y-1.5">
            <Label htmlFor="industry" className="text-sm text-foreground/80">
              {t('industry')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="industry"
              placeholder="ex : Technologie, Santé, Finance..."
              {...register('industry')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          {/* Site web */}
          <div className="space-y-1.5">
            <Label htmlFor="website" className="text-sm text-foreground/80">
              {t('website')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="website"
              type="url"
              placeholder="https://exemple.com"
              {...register('website')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            {errors.website && (
              <p className="text-xs text-red-400">{errors.website.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm text-foreground/80">
              {t('description')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Brève description du client et de ses activités..."
              rows={3}
              {...register('description')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 resize-none"
            />
          </div>

          {/* Email config separator */}
          <div className="flex items-center gap-3 pt-1">
            <Separator className="flex-1 bg-white/[0.06]" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Configuration email
            </span>
            <Separator className="flex-1 bg-white/[0.06]" />
          </div>

          {/* Nom de l'expéditeur */}
          <div className="space-y-1.5">
            <Label htmlFor="sender_name" className="text-sm text-foreground/80">
              {t('senderName')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="sender_name"
              placeholder="ex : Marie Dupont"
              {...register('sender_name')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
          </div>

          {/* Email expéditeur */}
          <div className="space-y-1.5">
            <Label htmlFor="sender_email" className="text-sm text-foreground/80">
              {t('senderEmail')}
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Input
              id="sender_email"
              type="email"
              placeholder="ex : marie@hermespressroom.com"
              {...register('sender_email')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
            />
            {errors.sender_email && (
              <p className="text-xs text-red-400">{errors.sender_email.message}</p>
            )}
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
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon('loading')}
                </>
              ) : isEditing ? (
                tCommon('save')
              ) : (
                t('addClient')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
