import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ClientCard } from '@/components/clients/client-card';
import { ClientsHeader } from '@/components/clients/clients-header';
import type { ClientRow } from '@/types/database';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clients');
  return { title: t('title') };
}

export default async function ClientsPage() {
  const t = await getTranslations('clients');
  const supabase = await createClient();

  // Get authenticated user's organization
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let clients: ClientRow[] = [];

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profile?.organization_id) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      clients = data ?? [];
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ClientsHeader />

      {clients && clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display text-sm font-medium text-foreground mb-1">
            {t('noClients')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('noClientsDescription')}</p>
        </div>
      )}
    </div>
  );
}
