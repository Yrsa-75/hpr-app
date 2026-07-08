import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ClientOption = { id: string; name: string };
export type CampaignOption = {
  id: string;
  name: string;
  client_id: string;
  communique: string | null;
};

export type AttributionOptions = {
  clients: ClientOption[];
  campaigns: CampaignOption[];
};

/**
 * Charge la liste des clients et des campagnes (chacune portant son communiqué courant)
 * pour alimenter les sélecteurs d'attribution des retombées presse.
 * Scopé à l'organisation de l'utilisateur via RLS.
 */
export async function getAttributionOptions(
  supabase: SupabaseServerClient
): Promise<AttributionOptions> {
  const [{ data: clients }, { data: campaigns }] = await Promise.all([
    supabase.from('clients').select('id, name').order('name', { ascending: true }),
    supabase
      .from('campaigns')
      .select('id, name, client_id, press_releases(title, is_current, version)')
      .neq('status', 'archived')
      .order('created_at', { ascending: false }),
  ]);

  const campaignOptions: CampaignOption[] = (campaigns ?? []).map((c) => {
    const releases = (c.press_releases ?? []) as {
      title: string;
      is_current: boolean;
      version: number;
    }[];
    const current =
      releases
        .filter((r) => r.is_current)
        .sort((a, b) => b.version - a.version)[0] ?? releases[0];
    return {
      id: c.id,
      name: c.name,
      client_id: c.client_id,
      communique: current?.title ?? null,
    };
  });

  return {
    clients: (clients ?? []) as ClientOption[],
    campaigns: campaignOptions,
  };
}
