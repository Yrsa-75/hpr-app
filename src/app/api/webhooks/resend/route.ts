import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createServiceClient } from '@/lib/supabase/server';

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id: string;
    created_at: string;
    // bounce fields
    bounce?: {
      type?: string; // 'hard' | 'soft'
      message?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify signature if secret is configured
  if (secret) {
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing svix headers' }, { status: 401 });
    }

    const rawBody = await request.text();
    try {
      const wh = new Webhook(secret);
      wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    try {
      const body = JSON.parse(rawBody) as ResendWebhookEvent;
      return await handleEvent(body);
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
  }

  // No secret configured — process without verification (dev mode)
  try {
    const body = await request.json() as ResendWebhookEvent;
    return await handleEvent(body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

async function handleEvent(body: ResendWebhookEvent) {
  const supabase = createServiceClient();

  const emailId = body.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  switch (body.type) {
    case 'email.delivered':
      updates.status = 'delivered';
      break;
    case 'email.opened':
      updates.status = 'opened';
      updates.opened_at = now;
      break;
    case 'email.clicked':
      updates.status = 'clicked';
      updates.clicked_at = now;
      updates.opened_at = now; // set opened_at if not already set (pixel may have been blocked)
      break;
    case 'email.bounced': {
      updates.status = 'bounced';
      updates.bounced_at = now;
      const bounceType = body.data?.bounce?.type;
      const bounceMsg = body.data?.bounce?.message;
      const parts = [bounceType, bounceMsg].filter(Boolean);
      if (parts.length) updates.bounce_reason = parts.join(' — ');
      break;
    }
    case 'email.complained':
      updates.status = 'complained';
      updates.complained_at = now;
      break;
    default:
      return NextResponse.json({ ok: true });
  }

  // For clicked events, only set opened_at if not already set
  if (body.type === 'email.clicked' && updates.opened_at) {
    const { opened_at, ...otherUpdates } = updates;
    await supabase.from('email_sends').update(otherUpdates).eq('resend_email_id', emailId);
    await supabase.from('email_sends').update({ opened_at }).eq('resend_email_id', emailId).is('opened_at', null);
  } else {
    await supabase.from('email_sends').update(updates).eq('resend_email_id', emailId);
  }

  // Sur open/click : mettre à jour le quality_score du journaliste
  if (body.type === 'email.opened' || body.type === 'email.clicked') {
    const { data: send } = await supabase
      .from('email_sends')
      .select('journalist_id')
      .eq('resend_email_id', emailId)
      .single();

    if (send?.journalist_id) {
      const { data: newScore } = await supabase.rpc('calculate_journalist_quality_score', {
        p_journalist_id: send.journalist_id,
      });
      if (newScore !== null) {
        await supabase
          .from('journalists')
          .update({ quality_score: newScore, updated_at: now })
          .eq('id', send.journalist_id);
      }
    }
  }

  // Sur un complained : marquer le journaliste comme désinscrit (opt-out RGPD)
  if (body.type === 'email.complained') {
    const { data: send } = await supabase
      .from('email_sends')
      .select('journalist_id')
      .eq('resend_email_id', emailId)
      .single();

    if (send?.journalist_id) {
      const { data: journalist } = await supabase
        .from('journalists')
        .select('tags')
        .eq('id', send.journalist_id)
        .single();

      if (journalist) {
        const currentTags: string[] = journalist.tags ?? [];
        const newTags = [...new Set([...currentTags, 'opted-out'])];
        await supabase
          .from('journalists')
          .update({ is_opted_out: true, tags: newTags, updated_at: now })
          .eq('id', send.journalist_id);
      }
    }
  }

  // Sur un bounce : vider l'email du journaliste pour que Hunter retente
  if (body.type === 'email.bounced') {
    const { data: send } = await supabase
      .from('email_sends')
      .select('journalist_id')
      .eq('resend_email_id', emailId)
      .single();

    if (send?.journalist_id) {
      const { data: journalist } = await supabase
        .from('journalists')
        .select('tags')
        .eq('id', send.journalist_id)
        .single();

      if (journalist) {
        const currentTags: string[] = journalist.tags ?? [];
        const newTags = [
          ...currentTags.filter((t) => t !== 'validate' && t !== 'email-bounced' && t !== 'hunter-tried'),
          'email-bounced',
        ];
        await supabase
          .from('journalists')
          .update({
            email: null,
            tags: newTags,
            updated_at: now,
          })
          .eq('id', send.journalist_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
