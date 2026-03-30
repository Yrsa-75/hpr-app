import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { InboxView, type ThreadWithJoins } from '@/components/inbox/inbox-view';
import { processInboundEmails } from '@/lib/resend/process-inbound';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('inbox');
  return { title: t('title') };
}

export default async function InboxPage() {
  const t = await getTranslations('inbox');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Pull new emails from Resend and process them before rendering
  if (user) {
    await processInboundEmails();
  }

  let threads: ThreadWithJoins[] = [];

  if (user) {
    const { data } = await supabase
      .from('email_threads')
      .select(`
        *,
        journalists(first_name, last_name, email, media_outlet),
        campaigns(id, name, clients(name)),
        email_messages(*)
      `)
      .order('updated_at', { ascending: false });

    if (data) {
      threads = (data as ThreadWithJoins[]).map((thread) => ({
        ...thread,
        email_messages: (thread.email_messages ?? []).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }));
    }
  }

  const pendingCount = threads.filter(
    (t) => t.status === 'new' || t.status === 'needs_response'
  ).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-hpr-gold/20 text-hpr-gold text-xs px-2.5 py-1 rounded-full font-medium">
            {pendingCount} à traiter
          </span>
        )}
      </div>

      <InboxView threads={threads} />
    </div>
  );
}
