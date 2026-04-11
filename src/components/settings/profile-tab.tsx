'use client';

import * as React from 'react';
import { User, Camera, Lock, Check, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getInitials } from '@/lib/utils';
import {
  updateProfileAction,
  uploadAvatarAction,
  changePasswordAction,
} from '@/app/[locale]/(dashboard)/settings/actions';

interface ProfileTabProps {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    role: string;
  };
}

function StatusMessage({ result }: { result: { success?: boolean; error?: string } | null }) {
  if (!result) return null;
  if (result.success) return (
    <p className="flex items-center gap-1.5 text-xs text-green-400">
      <Check className="h-3.5 w-3.5" /> Enregistré
    </p>
  );
  return (
    <p className="flex items-center gap-1.5 text-xs text-red-400">
      <AlertCircle className="h-3.5 w-3.5" /> {result.error}
    </p>
  );
}

export function ProfileTab({ user }: ProfileTabProps) {
  const [avatarUrl, setAvatarUrl] = React.useState(user.avatar_url);
  const [profileResult, setProfileResult] = React.useState<{ success?: boolean; error?: string } | null>(null);
  const [passwordResult, setPasswordResult] = React.useState<{ success?: boolean; error?: string } | null>(null);
  const [profilePending, setProfilePending] = React.useState(false);
  const [passwordPending, setPasswordPending] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const displayName = user.full_name || user.email;

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setAvatarUrl(preview);
    const fd = new FormData();
    fd.append('file', file);
    const result = await uploadAvatarAction(fd);
    if (result.url) setAvatarUrl(result.url);
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfilePending(true);
    setProfileResult(null);
    const result = await updateProfileAction(new FormData(e.currentTarget));
    setProfileResult(result);
    setProfilePending(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordPending(true);
    setPasswordResult(null);
    const result = await changePasswordAction(new FormData(e.currentTarget));
    setPasswordResult(result);
    setPasswordPending(false);
    if (result.success) (e.target as HTMLFormElement).reset();
  }

  return (
    <div className="space-y-6">
      {/* Avatar + Identity */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="relative">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-hpr-gold/20 text-hpr-gold text-lg font-bold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-hpr-gold text-black hover:bg-hpr-gold/90 transition-colors"
            >
              <Camera className="h-3 w-3" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <span className="mt-1 inline-block text-[11px] bg-hpr-gold/20 text-hpr-gold px-2 py-0.5 rounded-full">
              {user.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="flex items-center gap-2 mb-4 text-sm font-medium text-foreground">
            <User className="h-4 w-4 text-muted-foreground" />
            Informations personnelles
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="full_name">Nom complet</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={user.full_name ?? ''}
                placeholder="Votre nom"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Adresse email</Label>
              <Input value={user.email} disabled className="opacity-50 cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié ici.</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <StatusMessage result={profileResult} />
            <Button type="submit" size="sm" disabled={profilePending}>
              {profilePending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-foreground">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Changer de mot de passe
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <StatusMessage result={passwordResult} />
            <Button type="submit" size="sm" variant="outline" disabled={passwordPending}>
              {passwordPending ? 'Mise à jour...' : 'Changer le mot de passe'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
