'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePassword } from '@/app/[locale]/(auth)/actions';

const schema = z.object({
  password: z.string().min(8, 'Au moins 8 caractères'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormValues) => {
    setError('');
    startTransition(async () => {
      const formData = new FormData();
      formData.append('password', data.password);
      const result = await updatePassword(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
          Nouveau mot de passe
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold"
          {...register('password')}
          disabled={isPending}
        />
        {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm" className="text-sm font-medium text-foreground/80">
          Confirmer le mot de passe
        </Label>
        <Input
          id="confirm"
          type="password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 focus-visible:ring-hpr-gold focus-visible:border-hpr-gold"
          {...register('confirm')}
          disabled={isPending}
        />
        {errors.confirm && <p className="text-xs text-red-400">{errors.confirm.message}</p>}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <Button type="submit" variant="gold" className="w-full" disabled={isPending}>
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mise à jour...</> : 'Mettre à jour le mot de passe'}
      </Button>
    </form>
  );
}
