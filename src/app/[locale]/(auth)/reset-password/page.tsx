import type { Metadata } from 'next';
import { HprLogoFull } from '@/components/logo';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = { title: 'Nouveau mot de passe — Hermès Press Room' };

export default function ResetPasswordPage() {
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
              Nouveau mot de passe
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choisissez un nouveau mot de passe pour votre compte.
            </p>
          </div>

          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
