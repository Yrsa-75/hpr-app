import { createServiceClient } from '@/lib/supabase/server';

export const metadata = { title: 'Désinscription' };

async function processUnsubscribe(sendId: string): Promise<'ok' | 'already' | 'invalid'> {
  const supabase = createServiceClient();

  // Lookup the email_send to find the journalist
  const { data: send } = await supabase
    .from('email_sends')
    .select('journalist_id')
    .eq('id', sendId)
    .single();

  if (!send) return 'invalid';

  const { data: journalist } = await supabase
    .from('journalists')
    .select('id, is_opted_out')
    .eq('id', send.journalist_id)
    .single();

  if (!journalist) return 'invalid';
  if (journalist.is_opted_out) return 'already';

  await supabase
    .from('journalists')
    .update({ is_opted_out: true })
    .eq('id', journalist.id);

  return 'ok';
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ send?: string }>;
}) {
  const { send } = await searchParams;

  let status: 'ok' | 'already' | 'invalid' | 'missing' = 'missing';

  if (send) {
    // Basic UUID format check before hitting the DB
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    status = uuidRegex.test(send) ? await processUnsubscribe(send) : 'invalid';
  }

  const content = {
    ok: {
      icon: '✓',
      iconColor: '#22c55e',
      title: 'Désinscription confirmée',
      body: 'Vous avez été retiré de notre liste de diffusion. Vous ne recevrez plus de communiqués de presse de notre part.',
    },
    already: {
      icon: '✓',
      iconColor: '#22c55e',
      title: 'Déjà désinscrit',
      body: 'Votre adresse est déjà retirée de notre liste de diffusion.',
    },
    invalid: {
      icon: '✕',
      iconColor: '#ef4444',
      title: 'Lien invalide',
      body: 'Ce lien de désinscription est invalide ou a déjà expiré. Si vous souhaitez vous désinscrire, répondez directement à l\'un de nos emails.',
    },
    missing: {
      icon: '?',
      iconColor: '#6b7280',
      title: 'Lien incomplet',
      body: 'Ce lien de désinscription est incomplet.',
    },
  }[status];

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Désinscription — Hermès Press Room</title>
      </head>
      <body style={{ margin: 0, padding: 0, background: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: status === 'ok' || status === 'already' ? '#f0fdf4' : status === 'invalid' ? '#fef2f2' : '#f9fafb',
            border: `2px solid ${content.iconColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: 28, color: content.iconColor,
          }}>
            {content.icon}
          </div>

          {/* HPR attribution */}
          <p style={{ fontSize: 11, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 32 }}>
            Hermès Press Room
          </p>

          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>
            {content.title}
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: '#555', margin: 0 }}>
            {content.body}
          </p>
        </div>
      </body>
    </html>
  );
}
