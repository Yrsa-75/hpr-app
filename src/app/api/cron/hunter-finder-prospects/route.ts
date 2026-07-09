/**
 * Cron: Hunter Email Finder — Prospects
 * Cherche les emails manquants pour les prospects sans email.
 * Batch de 15 par run pour préserver les crédits Hunter.
 * Planifié toutes les 6h dans vercel.json.
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
  // Fail-closed : route non planifiée (pipeline Hunter côté Supabase),
  // ne doit jamais être déclenchable sans secret
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: task } = await supabase
    .from('background_tasks')
    .insert({ type: 'hunter_finder_prospects', status: 'running', started_at: now })
    .select('id')
    .single();

  const taskId = task?.id;

  try {
    // Prospects sans email, sans tag hunter-tried, non opted-out
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id, first_name, last_name, company, tags')
      .is('email', null)
      .eq('is_opted_out', false)
      .not('tags', 'cs', '{"hunter-tried"}')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    const total = prospects?.length ?? 0;
    let processed = 0, found = 0, skipped = 0, failed = 0, credits = 0;
    const details: { name: string; result: string }[] = [];

    for (const p of prospects ?? []) {
      if (!p.company?.trim()) {
        skipped++;
        const tags = [...new Set([...(p.tags ?? []), 'hunter-tried'])];
        await supabase.from('prospects').update({ tags, updated_at: now }).eq('id', p.id);
        details.push({ name: `${p.first_name} ${p.last_name}`, result: 'skipped (no company)' });
        continue;
      }

      try {
        const result = await hunterFindEmail(p.first_name, p.last_name, p.company);
        credits++;
        processed++;

        if (result.found && result.email) {
          found++;
          const tags = [...new Set([...(p.tags ?? []).filter((t: string) => t !== 'hunter-tried'), 'via-hunter'])];
          await supabase.from('prospects').update({
            email: result.email.toLowerCase(),
            tags,
            updated_at: now,
          }).eq('id', p.id);
          details.push({ name: `${p.first_name} ${p.last_name}`, result: `found: ${result.email} (score ${result.score})` });
        } else {
          const tags = [...new Set([...(p.tags ?? []), 'hunter-tried'])];
          await supabase.from('prospects').update({ tags, updated_at: now }).eq('id', p.id);
          details.push({ name: `${p.first_name} ${p.last_name}`, result: 'not found' });
        }
      } catch (err) {
        failed++;
        details.push({ name: `${p.first_name} ${p.last_name}`, result: `error: ${String(err)}` });
      }

      await new Promise((r) => setTimeout(r, 300));
    }

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

    console.log(`[HPR hunter-finder-prospects] ${found}/${total} emails trouvés, ${credits} crédits utilisés`);
    return NextResponse.json({ ok: true, total, processed, found, skipped, failed, credits });

  } catch (err) {
    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(err),
      }).eq('id', taskId);
    }
    console.error('[HPR hunter-finder-prospects] Fatal error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
