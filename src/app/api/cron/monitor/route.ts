import { NextRequest, NextResponse } from 'next/server';
import { monitorGoogleNews } from '@/lib/monitoring/google-news';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: task } = await supabase
    .from('background_tasks')
    .insert({ type: 'google_news', status: 'running', started_at: now })
    .select('id')
    .single();

  const taskId = task?.id;

  try {
    const result = await monitorGoogleNews();
    console.log('[HPR cron] Google News monitoring done:', result);

    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        found: (result as { found?: number }).found ?? 0,
        processed: (result as { checked?: number }).checked ?? 0,
        details: result as Record<string, unknown>,
      }).eq('id', taskId);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[HPR cron] Error:', err);
    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(err),
      }).eq('id', taskId);
    }
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
