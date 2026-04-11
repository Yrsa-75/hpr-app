'use client';

import * as React from 'react';
import { Building2, ImageIcon, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateOrganisationAction,
  uploadOrgLogoAction,
} from '@/app/[locale]/(dashboard)/settings/actions';

interface OrganisationTabProps {
  organisation: {
    id: string;
    name: string;
    logo_url: string | null;
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

export function OrganisationTab({ organisation }: OrganisationTabProps) {
  const [logoUrl, setLogoUrl] = React.useState(organisation.logo_url);
  const [result, setResult] = React.useState<{ success?: boolean; error?: string } | null>(null);
  const [pending, setPending] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUrl(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append('file', file);
    const res = await uploadOrgLogoAction(fd);
    if (res.url) setLogoUrl(res.url);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    const res = await updateOrganisationAction(new FormData(e.currentTarget));
    setResult(res);
    setPending(false);
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-6 text-sm font-medium text-foreground">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        Informations de l'agence
      </div>

      {/* Logo */}
      <div className="mb-6">
        <Label className="mb-2 block">Logo de l'agence</Label>
        <div className="flex items-center gap-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 hover:border-hpr-gold/40 hover:bg-hpr-gold/5 transition-colors overflow-hidden"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
            )}
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoUrl ? 'Changer le logo' : 'Importer un logo'}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG ou SVG — max 5 Mo</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom de l'agence</Label>
          <Input
            id="name"
            name="name"
            defaultValue={organisation.name}
            placeholder="Hermès Press Room"
            required
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <StatusMessage result={result} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
