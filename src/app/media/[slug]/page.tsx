import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Download, ExternalLink, Globe, FileText, Image, FileArchive, File } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import type { ClientMediaAssetRow } from '@/types/database';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase.from('clients').select('name').eq('slug', slug).single();
  if (!data) return { title: 'Pack Média' };
  return {
    title: `Pack Média — ${data.name}`,
    description: `Téléchargez les ressources visuelles et documents de presse de ${data.name}.`,
  };
}

function fileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-gray-400" />;
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-400" />;
  if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-400" />;
  if (mimeType.includes('zip')) return <FileArchive className="h-5 w-5 text-yellow-400" />;
  return <File className="h-5 w-5 text-gray-400" />;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function MediaPackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, industry, logo_url, description, website')
    .eq('slug', slug)
    .single();

  if (!client) return notFound();

  const { data: assets } = await supabase
    .from('client_media_assets')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: true });

  const assetList: ClientMediaAssetRow[] = assets ?? [];

  // Build initials
  const initials = (() => {
    const parts = client.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return client.name.slice(0, 2).toUpperCase();
  })();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header bar */}
      <header className="border-b border-white/[0.06] bg-[#0d0d0f]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* HPR logo / attribution */}
            <span className="text-xs text-white/30 font-medium tracking-widest uppercase">
              Hermès Press Room
            </span>
          </div>
          <span className="text-xs text-white/20">Pack Média</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Brand card */}
        <div className="flex items-start gap-5">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-20 w-20 rounded-2xl object-cover flex-shrink-0 border border-white/10"
            />
          ) : (
            <div className="h-20 w-20 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#B8860B]/20 border border-[#B8860B]/30">
              <span className="text-2xl font-bold text-[#B8860B]">{initials}</span>
            </div>
          )}
          <div className="space-y-2 pt-1">
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {client.industry && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                  {client.industry}
                </span>
              )}
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-[#B8860B] transition-colors"
                >
                  <Globe className="h-3 w-3" />
                  {client.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            {client.description && (
              <p className="text-sm text-white/50 leading-relaxed max-w-xl">
                {client.description}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06]" />

        {/* Downloads */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Ressources disponibles</h2>
            <p className="text-sm text-white/40 mt-1">
              Téléchargez librement les éléments visuels et documents ci-dessous.
            </p>
          </div>

          {assetList.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] border-dashed p-14 text-center">
              <p className="text-sm text-white/30">Aucune ressource disponible pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assetList.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#B8860B]/30 px-5 py-4 transition-all"
                >
                  <div className="flex-shrink-0">{fileIcon(asset.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white group-hover:text-[#B8860B] transition-colors truncate">
                      {asset.display_name}
                    </p>
                    {asset.file_size && (
                      <p className="text-xs text-white/30 mt-0.5">{formatBytes(asset.file_size)}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/30 group-hover:text-[#B8860B] transition-colors">
                    <Download className="h-4 w-4" />
                    <span>Télécharger</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] pt-6 text-center">
          <p className="text-xs text-white/20">
            Pack média généré via{' '}
            <a
              href="https://hermespressroom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/40 transition-colors"
            >
              Hermès Press Room
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
