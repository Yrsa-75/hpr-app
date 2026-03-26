import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HprLogo } from '@/components/logo';
import { RegisterForm } from '@/components/auth/register-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: t('registerTitle'),
  };
}

export default async function RegisterPage() {
  const t = await getTranslations('auth');

  return (
    <div className="min-h-screen bg-hpr-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(184,134,11,0.08)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(30,58,95,0.15)_0%,_transparent_60%)]" />

      <div className="relative w-full max-w-lg animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <HprLogo variant="full" size="lg" />
        </div>

        {/* Register card */}
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="mb-6">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {t('createAccount')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('registerSubtitle')}
            </p>
          </div>

          <RegisterForm />

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-muted-foreground">
              {t('alreadyAccount')}{' '}
              <Link
                href="/fr/login"
                className="text-hpr-gold hover:text-hpr-gold-light transition-colors font-medium"
              >
                {t('login')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
