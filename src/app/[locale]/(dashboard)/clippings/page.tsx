import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { monitorGoogleNews } from '@/lib/monitoring/google-news';
import { ClippingsView } from '@/components/clippings/clippings-view';
import type { PressClippingRow } from '@/types/database';

export const metadata: Metadata = { title: 'Retombées presse — HPR' };

export type ClippingWithJoins = PressClippingRow & {
  campaigns: { name: string } | null;
  clients: { name: string } | null;
};

export default async function ClippingsPage() {
  const supabase = await createClient();

  // Run monitoring in background (non-blocking for rendering)
  monitorGoogleNews().catch(() => {});

  const { data: clippings } = await supabase
    .from('press_clippings')
    .select('*, campaigns(name), clients(name)')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <ClippingsView clippings={(clippings ?? []) as ClippingWithJoins[]} />
  );
}
