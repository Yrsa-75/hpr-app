import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createServiceClient } from '@/lib/supabase/server';

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id: string;
    created_at: string;
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
      break;
    case 'email.bounced':
      updates.status = 'bounced';
      updates.bounced_at = now;
      break;
    case 'email.complained':
      updates.status = 'complained';
      break;
    default:
      return NextResponse.json({ ok: true });
  }

  await supabase
    .from('email_sends')
    .update(updates)
    .eq('resend_email_id', emailId);

  return NextResponse.json({ ok: true });
}
