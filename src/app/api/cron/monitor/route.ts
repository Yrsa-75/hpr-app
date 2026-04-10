import { NextRequest, NextResponse } from 'next/server';
import { monitorGoogleNews } from '@/lib/monitoring/google-news';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel signs cron requests with this header
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await monitorGoogleNews();
    console.log('[HPR cron] Google News monitoring done:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[HPR cron] Error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
