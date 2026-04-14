/**
 * Cron: Hunter Email Finder
 * Cherche les emails manquants pour les journalistes sans email.
 * Batch de 15 par run pour préserver les crédits Hunter.
 * Planifié toutes les 4h dans vercel.json.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hunterFindEmail } from '@/lib/hunter';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 15;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Créer le run en DB
  const { data: task } = await supabase
    .from('background_tasks')
    .insert({ type: 'hunter_finder', status: 'running', started_at: now })
    .select('id')
    .single();

  const taskId = task?.id;

  try {
    // Journalistes sans email, sans tag hunter-tried, non opted-out
    const { data: journalists } = await supabase
      .from('journalists')
      .select('id, first_name, last_name, media_outlet, tags')
      .is('email', null)
      .eq('is_opted_out', false)
      .not('tags', 'cs', '{"hunter-tried"}')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    const total = journalists?.length ?? 0;
    let processed = 0, found = 0, skipped = 0, failed = 0, credits = 0;
    const details: { name: string; result: string }[] = [];

    for (const j of journalists ?? []) {
      if (!j.media_outlet?.trim()) {
        skipped++;
        // Pas de média → on ne peut pas chercher
        const tags = [...new Set([...(j.tags ?? []), 'hunter-tried'])];
        await supabase.from('journalists').update({ tags, updated_at: now }).eq('id', j.id);
        details.push({ name: `${j.first_name} ${j.last_name}`, result: 'skipped (no media)' });
        continue;
      }

      try {
        const result = await hunterFindEmail(j.first_name, j.last_name, j.media_outlet);
        credits++;
        processed++;

        if (result.found && result.email) {
          found++;
          const tags = [...new Set([...(j.tags ?? []).filter((t) => t !== 'hunter-tried'), 'via-hunter'])];
          await supabase.from('journalists').update({
            email: result.email.toLowerCase(),
            tags,
            updated_at: now,
          }).eq('id', j.id);
          details.push({ name: `${j.first_name} ${j.last_name}`, result: `found: ${result.email} (score ${result.score})` });
        } else {
          const tags = [...new Set([...(j.tags ?? []), 'hunter-tried'])];
          await supabase.from('journalists').update({ tags, updated_at: now }).eq('id', j.id);
          details.push({ name: `${j.first_name} ${j.last_name}`, result: 'not found' });
        }
      } catch (err) {
        failed++;
        details.push({ name: `${j.first_name} ${j.last_name}`, result: `error: ${String(err)}` });
      }

      // Pause 300ms entre les appels pour éviter le rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    // Mettre à jour le run en DB
    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total,
        processed,
        found,
        skipped,
        failed_count: failed,
        credits_used: credits,
        details: { runs: details },
      }).eq('id', taskId);
    }

    console.log(`[HPR hunter-finder] ${found}/${total} emails trouvés, ${credits} crédits utilisés`);
    return NextResponse.json({ ok: true, total, processed, found, skipped, failed, credits });

  } catch (err) {
    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(err),
      }).eq('id', taskId);
    }
    console.error('[HPR hunter-finder] Fatal error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
