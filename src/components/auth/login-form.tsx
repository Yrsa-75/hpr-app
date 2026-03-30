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
import { signIn } from '@/app/[locale]/(auth)/actions';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('password', data.password);

      const result = await signIn(formData);

      if (result?.error) {
        toast({
          variant: 'destructive',
          title: t('loginError'),
          description: result.error,
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className="text-sm font-medium text-foreground/80"
        >
          {t('email')}
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          className="bg-white/5 border-white/10 text-foreground placeholder:text-foreground/30 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold transition-colors"
          {...register('email')}
          disabled={isPending}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-foreground/80"
          >
            {t('password')}
          </Label>
          <a
            href="/fr/forgot-password"
            className="text-xs text-hpr-gold hover:text-hpr-gold-light transition-colors"
          >
            {t('forgotPassword')}
          </a>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 text-foreground placeholder:text-foreground/30 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold transition-colors"
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
            {t('loggingIn')}
          </>
        ) : (
          t('login')
        )}
      </Button>
    </form>
  );
}
