import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProfileTab } from '@/components/settings/profile-tab';
import { OrganisationTab } from '@/components/settings/organisation-tab';
import { SendersTab } from '@/components/settings/senders-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';

export const metadata: Metadata = { title: 'Paramètres — HPR' };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data: profile }, { data: clients }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, avatar_url, role, organization_id, preferences')
      .eq('id', user.id)
      .single(),
    supabase
      .from('clients')
      .select('id, name, sender_name, sender_email, logo_url')
      .order('name'),
  ]);

  const { data: organisation } = profile?.organization_id
    ? await supabase
        .from('organizations')
        .select('id, name, logo_url, settings')
        .eq('id', profile.organization_id)
        .single()
    : { data: null };

  const userProfile = {
    id: profile?.id ?? user.id,
    full_name: profile?.full_name ?? null,
    email: profile?.email ?? user.email ?? '',
    avatar_url: profile?.avatar_url ?? null,
    role: profile?.role ?? 'member',
  };

  const notifPrefs = (
    (profile?.preferences as Record<string, unknown>)?.notifications as Record<string, boolean>
  ) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez votre espace Hermès Press Room
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
          <TabsTrigger value="senders">Expéditeurs email</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab user={userProfile} />
        </TabsContent>

        <TabsContent value="organisation" className="mt-6">
          {organisation ? (
            <OrganisationTab organisation={organisation} />
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
              <p className="text-sm text-muted-foreground">Organisation introuvable.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="senders" className="mt-6">
          <SendersTab clients={clients ?? []} locale={locale} />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsTab preferences={notifPrefs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
