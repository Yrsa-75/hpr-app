/**
 * Cron: Hunter Email Verifier
 * Vérifie les emails existants non encore validés.
 * Batch de 30 par run. Planifié quotidiennement à 7h.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hunterVerifyEmail } from '@/lib/hunter';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 30;

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
    .insert({ type: 'hunter_verifier', status: 'running', started_at: now })
    .select('id')
    .single();

  const taskId = task?.id;

  try {
    // Journalistes avec email, sans tag de validation, non bounced, non opted-out
    const { data: journalists } = await supabase
      .from('journalists')
      .select('id, first_name, last_name, email, tags')
      .not('email', 'is', null)
      .eq('is_opted_out', false)
      .not('tags', 'cs', '{"email-verified"}')
      .not('tags', 'cs', '{"validate"}')
      .not('tags', 'cs', '{"email-bounced"}')
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE);

    const total = journalists?.length ?? 0;
    let processed = 0, verified = 0, invalid = 0, risky = 0, failed = 0, credits = 0;
    const details: { name: string; email: string; result: string }[] = [];

    for (const j of journalists ?? []) {
      if (!j.email) continue;

      try {
        const result = await hunterVerifyEmail(j.email);
        credits++;
        processed++;

        const currentTags: string[] = j.tags ?? [];
        let newTags = [...currentTags];

        if (result.result === 'deliverable') {
          verified++;
          newTags = [...new Set([...newTags, 'email-verified'])];
          await supabase.from('journalists').update({ tags: newTags, updated_at: now }).eq('id', j.id);
          details.push({ name: `${j.first_name} ${j.last_name}`, email: j.email, result: 'valid ✓' });
        } else if (result.result === 'undeliverable') {
          invalid++;
          // Email invalide : on le vide et on tag
          newTags = [...new Set([...newTags.filter((t) => t !== 'validate' && t !== 'email-verified'), 'email-bounced'])];
          await supabase.from('journalists').update({ email: null, tags: newTags, updated_at: now }).eq('id', j.id);
          details.push({ name: `${j.first_name} ${j.last_name}`, email: j.email, result: 'undeliverable → email cleared' });
        } else {
          risky++;
          // Risky ou unknown : on tag mais on garde l'email
          newTags = [...new Set([...newTags, result.result === 'risky' ? 'email-risky' : 'email-unverifiable'])];
          await supabase.from('journalists').update({ tags: newTags, updated_at: now }).eq('id', j.id);
          details.push({ name: `${j.first_name} ${j.last_name}`, email: j.email, result: result.result });
        }
      } catch (err) {
        failed++;
        details.push({ name: `${j.first_name} ${j.last_name}`, email: j.email ?? '', result: `error: ${String(err)}` });
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total,
        processed,
        found: verified,
        skipped: risky,
        failed_count: failed,
        credits_used: credits,
        details: { runs: details, invalid },
      }).eq('id', taskId);
    }

    console.log(`[HPR hunter-verifier] ${verified} valides, ${invalid} invalides, ${risky} risqués, ${credits} crédits`);
    return NextResponse.json({ ok: true, total, processed, verified, invalid, risky, failed, credits });

  } catch (err) {
    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(err),
      }).eq('id', taskId);
    }
    console.error('[HPR hunter-verifier] Fatal error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
