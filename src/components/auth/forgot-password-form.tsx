'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPasswordRequest } from '@/app/[locale]/(auth)/actions';

const schema = z.object({
  email: z.string().email('Email invalide'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormValues) => {
    setError('');
    startTransition(async () => {
      const formData = new FormData();
      formData.append('email', data.email);
      const result = await resetPasswordRequest(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    });
  };

  if (sent) {
    return (
      <div className="text-center py-4 space-y-3">
        <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
        <p className="text-sm text-foreground font-medium">Email envoyé !</p>
        <p className="text-xs text-muted-foreground">
          Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="vous@exemple.com"
          className="bg-white/5 border-white/10 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold"
          {...register('email')}
          disabled={isPending}
        />
        {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <Button type="submit" variant="gold" className="w-full" disabled={isPending}>
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi...</> : 'Envoyer le lien'}
      </Button>
    </form>
  );
}
