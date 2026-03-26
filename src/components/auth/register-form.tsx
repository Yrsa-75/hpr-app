'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { signUp } from '@/app/[locale]/(auth)/actions';

const registerSchema = z.object({
  full_name: z.string().min(2, 'Le nom doit faire au moins 2 caractères'),
  organization_name: z.string().min(2, "Le nom de l'organisation est requis"),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit faire au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterFormData) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('full_name', data.full_name);
      formData.append('organization_name', data.organization_name);
      formData.append('email', data.email);
      formData.append('password', data.password);

      const result = await signUp(formData);

      if (result?.error) {
        toast({
          variant: 'destructive',
          title: t('registerError'),
          description: result.error,
        });
      } else {
        toast({
          title: t('registerSuccess'),
          description: t('registerSuccessDescription'),
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-sm font-medium text-foreground/80">
            {t('fullName')}
          </Label>
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="Jean Dupont"
            className="bg-white/5 border-white/10 text-foreground placeholder:text-foreground/30 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold"
            {...register('full_name')}
            disabled={isPending}
          />
          {errors.full_name && (
            <p className="text-xs text-red-400">{errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="organization_name" className="text-sm font-medium text-foreground/80">
            {t('organizationName')}
          </Label>
          <Input
            id="organization_name"
            type="text"
            placeholder="Mon Agence RP"
            className="bg-white/5 border-white/10 text-foreground placeholder:text-foreground/30 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold"
            {...register('organization_name')}
            disabled={isPending}
          />
          {errors.organization_name && (
            <p className="text-xs text-red-400">{errors.organization_name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
          {t('email')}
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vous@agence.com"
          className="bg-white/5 border-white/10 text-foreground placeholder:text-foreground/30 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold"
          {...register('email')}
          disabled={isPending}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
          {t('password')}
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 text-foreground placeholder:text-foreground/30 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold"
          {...register('password')}
          disabled={isPending}
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="gold"
        className="w-full mt-2"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('registering')}
          </>
        ) : (
          t('createAccount')
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        {t('termsText')}{' '}
        <a href="#" className="text-hpr-gold hover:underline">
          {t('termsLink')}
        </a>{' '}
        {t('andText')}{' '}
        <a href="#" className="text-hpr-gold hover:underline">
          {t('privacyLink')}
        </a>
      </p>
    </form>
  );
}
