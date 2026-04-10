'use client';

import * as React from 'react';
import {
  Upload,
  Trash2,
  Download,
  FileText,
  Image,
  FileArchive,
  File,
  Copy,
  Check,
  Loader2,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  uploadMediaAssetAction,
  deleteMediaAssetAction,
} from '@/app/[locale]/(dashboard)/clients/[clientId]/media-actions';
import type { ClientMediaAssetRow } from '@/types/database';

interface MediaPackTabProps {
  clientId: string;
  clientSlug: string | null;
  assets: ClientMediaAssetRow[];
}

function fileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-400" />;
  if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-400" />;
  if (mimeType.includes('zip')) return <FileArchive className="h-5 w-5 text-yellow-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function MediaPackTab({ clientId, clientSlug, assets }: MediaPackTabProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const publicUrl = clientSlug
    ? `${process.env.NEXT_PUBLIC_APP_URL}/media/${clientSlug}`
    : null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !displayName) {
      // Auto-fill display name from filename (without extension)
      setDisplayName(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.set('file', selectedFile);
    formData.set('display_name', displayName.trim() || selectedFile.name);

    const result = await uploadMediaAssetAction(clientId, formData);
    setIsUploading(false);

    if (result.success) {
      toast({ title: 'Fichier ajouté au pack média' });
      setSelectedFile(null);
      setDisplayName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      toast({ title: result.error ?? 'Erreur upload', variant: 'destructive' });
    }
  }

  async function handleDelete(assetId: string) {
    setDeletingId(assetId);
    const result = await deleteMediaAssetAction(clientId, assetId);
    setDeletingId(null);
    if (result.success) {
      toast({ title: 'Fichier supprimé' });
    } else {
      toast({ title: result.error ?? 'Erreur suppression', variant: 'destructive' });
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Lien public */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-hpr-gold" />
          <h3 className="text-sm font-medium text-foreground">Lien public du pack média</h3>
        </div>
        {publicUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-muted-foreground truncate">
              {publicUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="border-white/[0.08] hover:border-white/20 shrink-0"
              onClick={copyLink}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5 text-xs">{copied ? 'Copié' : 'Copier'}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/[0.08] hover:border-white/20 shrink-0"
              asChild
            >
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs">
                Ouvrir
              </a>
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Lien en cours de génération...</p>
        )}
      </div>

      {/* Upload */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Ajouter un fichier</h3>
        <form onSubmit={handleUpload} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="media-file" className="text-xs text-muted-foreground">
              Fichier <span className="text-muted-foreground/60">(images, PDF, ZIP — max 50 Mo)</span>
            </Label>
            <Input
              id="media-file"
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,application/zip,application/x-zip-compressed,video/*"
              onChange={handleFileChange}
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 text-sm file:mr-3 file:text-xs file:border-0 file:bg-white/10 file:text-foreground file:rounded file:px-2 file:py-1 cursor-pointer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="media-display-name" className="text-xs text-muted-foreground">
              Nom affiché aux journalistes
            </Label>
            <Input
              id="media-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ex : Logo HD, Dossier de presse, Photos produit..."
              className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 text-sm"
            />
          </div>
          <Button
            type="submit"
            variant="gold"
            size="sm"
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Upload en cours...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-3.5 w-3.5" />
                Ajouter au pack média
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Liste des fichiers */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">
          Fichiers disponibles
          <span className="ml-2 text-xs font-normal text-muted-foreground">({assets.length})</span>
        </h3>

        {assets.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Aucun fichier dans le pack média.<br />
              Ajoutez logos, dossiers de presse, visuels produit...
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06] overflow-hidden">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex-shrink-0">{fileIcon(asset.mime_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{asset.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {asset.file_name}
                    {asset.file_size ? ` · ${formatBytes(asset.file_size)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    asChild
                  >
                    <a href={asset.file_url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                    onClick={() => handleDelete(asset.id)}
                    disabled={deletingId === asset.id}
                  >
                    {deletingId === asset.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
