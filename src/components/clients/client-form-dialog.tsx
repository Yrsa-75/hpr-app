'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Loader2, Upload, X } from 'lucide-react';

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
  signature_text: z.string().optional(),
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
  // Client logo (avatar on card)
  const [clientLogoFile, setClientLogoFile] = React.useState<File | null>(null);
  const [clientLogoPreview, setClientLogoPreview] = React.useState<string | null>(null);
  const clientLogoInputRef = React.useRef<HTMLInputElement>(null);
  // Signature logo
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isEditing = Boolean(client);

  const {
    register,
    handleSubmit,
    reset,
    watch,
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
      signature_text: client?.signature_text ?? '',
    },
  });

  const signatureText = watch('signature_text');

  React.useEffect(() => {
    if (open) {
      reset({
        name: client?.name ?? '',
        industry: client?.industry ?? '',
        website: client?.website ?? '',
        description: client?.description ?? '',
        sender_name: client?.sender_name ?? '',
        sender_email: client?.sender_email ?? '',
        signature_text: client?.signature_text ?? '',
      });
      setLogoFile(null);
      setLogoPreview(client?.signature_logo_url ?? null);
    }
  }, [open, client, reset]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Image trop lourde', description: 'Max 2 Mo', variant: 'destructive' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const onSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) formData.set(key, value);
      });

      if (logoFile) {
        formData.set('signature_logo', logoFile);
      } else if (logoPreview && client?.signature_logo_url === logoPreview) {
        // No new file but keeping the existing one
        formData.set('keep_existing_logo', 'true');
      }

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

  // Preview lines for the signature
  const signatureLines = (signatureText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const showPreview = logoPreview || signatureLines.length > 0;

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

          {/* Signature separator */}
          <div className="flex items-center gap-3 pt-1">
            <Separator className="flex-1 bg-white/[0.06]" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Signature email
            </span>
            <Separator className="flex-1 bg-white/[0.06]" />
          </div>

          {/* Logo de signature */}
          <div className="space-y-2">
            <Label className="text-sm text-foreground/80">
              Logo
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>

            {logoPreview ? (
              <div className="flex items-center gap-3">
                <div className="h-12 w-24 flex items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo signature" className="h-10 w-auto object-contain" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Changer
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                    className="h-7 text-xs text-red-400 hover:text-red-300 px-2"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-5 text-sm text-muted-foreground hover:border-hpr-gold/30 hover:bg-white/[0.03] hover:text-foreground/70 transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span>Cliquer pour ajouter un logo</span>
                <span className="text-xs">PNG, JPG, SVG — max 2 Mo</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Texte de signature */}
          <div className="space-y-1.5">
            <Label htmlFor="signature_text" className="text-sm text-foreground/80">
              Texte
              <span className="ml-1.5 text-xs text-muted-foreground">({tCommon('optional')})</span>
            </Label>
            <Textarea
              id="signature_text"
              placeholder={`Marie Dupont\nAttachée de presse — Hermès Press Room\n+33 6 12 34 56 78`}
              rows={4}
              {...register('signature_text')}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Une ligne = une ligne dans la signature</p>
          </div>

          {/* Preview signature */}
          {showPreview && (
            <div className="rounded-lg border border-white/[0.08] bg-white p-4 space-y-0">
              <p className="text-[10px] text-gray-400 mb-3 font-sans">Aperçu</p>
              <table cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif' }}>
                <tbody>
                  <tr>
                    {logoPreview && (
                      <td style={{ paddingRight: 14, verticalAlign: 'middle' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoPreview} alt="Logo" style={{ maxWidth: 150, width: 'auto', height: 'auto', display: 'block' }} />
                      </td>
                    )}
                    {signatureLines.length > 0 && (
                      <td style={{
                        borderLeft: logoPreview ? '2px solid #B8860B' : 'none',
                        paddingLeft: logoPreview ? 14 : 0,
                        verticalAlign: 'middle',
                      }}>
                        {signatureLines.map((line, i) => (
                          <div key={i} style={{
                            fontWeight: i === 0 ? 600 : 400,
                            fontSize: i === 0 ? 13 : 12,
                            color: i === 0 ? '#1a1a1a' : '#555',
                            lineHeight: 1.4,
                          }}>
                            {line}
                          </div>
                        ))}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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
