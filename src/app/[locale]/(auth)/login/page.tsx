import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HprLogoFull } from '@/components/logo';
import { LoginForm } from '@/components/auth/login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return {
    title: t('loginTitle'),
  };
}

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <div className="min-h-screen bg-hpr-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(184,134,11,0.08)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(30,58,95,0.15)_0%,_transparent_60%)]" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(184,134,11,1) 1px, transparent 1px), linear-gradient(90deg, rgba(184,134,11,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <HprLogoFull />
        </div>

        {/* Login card */}
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="mb-6">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {t('welcomeBack')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('loginSubtitle')}
            </p>
          </div>

          <LoginForm />

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-muted-foreground">
              {t('noAccount')}{' '}
              <Link
                href="/fr/register"
                className="text-hpr-gold hover:text-hpr-gold-light transition-colors font-medium"
              >
                {t('createAccount')}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          &copy; {new Date().getFullYear()} Hermès Press Room. {t('allRightsReserved')}
        </p>
      </div>
    </div>
  );
}
