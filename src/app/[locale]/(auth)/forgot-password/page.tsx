import type { Metadata } from 'next';
import Link from 'next/link';
import { HprLogoFull } from '@/components/logo';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Mot de passe oublié — Hermès Press Room' };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-hpr-dark flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(184,134,11,0.08)_0%,_transparent_60%)]" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="flex justify-center mb-10">
          <HprLogoFull />
        </div>

        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
          <div className="mb-6">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Mot de passe oublié
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Entrez votre email pour recevoir un lien de réinitialisation.
            </p>
          </div>

          <ForgotPasswordForm />

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <Link href="/fr/login" className="text-sm text-hpr-gold hover:text-hpr-gold/80 transition-colors">
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
