/**
 * Cron: Hunter Email Verifier — Prospects
 * Vérifie les emails existants des prospects non encore validés.
 * Batch de 30 par run. Planifié quotidiennement à 8h.
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
  // Fail-closed : route non planifiée (pipeline Hunter côté Supabase),
  // ne doit jamais être déclenchable sans secret
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: task } = await supabase
    .from('background_tasks')
    .insert({ type: 'hunter_verifier_prospects', status: 'running', started_at: now })
    .select('id')
    .single();

  const taskId = task?.id;

  try {
    // Prospects avec email, sans tag de validation, non bounced, non opted-out
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id, first_name, last_name, email, tags')
      .not('email', 'is', null)
      .eq('is_opted_out', false)
      .not('tags', 'cs', '{"email-verified"}')
      .not('tags', 'cs', '{"validate"}')
      .not('tags', 'cs', '{"email-bounced"}')
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE);

    const total = prospects?.length ?? 0;
    let processed = 0, verified = 0, invalid = 0, risky = 0, failed = 0, credits = 0;
    const details: { name: string; email: string; result: string }[] = [];

    for (const p of prospects ?? []) {
      if (!p.email) continue;

      try {
        const result = await hunterVerifyEmail(p.email);
        credits++;
        processed++;

        const currentTags: string[] = p.tags ?? [];
        let newTags = [...currentTags];

        if (result.result === 'deliverable') {
          verified++;
          newTags = [...new Set([...newTags, 'email-verified'])];
          await supabase.from('prospects').update({ tags: newTags, updated_at: now }).eq('id', p.id);
          details.push({ name: `${p.first_name} ${p.last_name}`, email: p.email, result: 'valid ✓' });
        } else if (result.result === 'undeliverable') {
          invalid++;
          newTags = [...new Set([...newTags.filter((t) => t !== 'validate' && t !== 'email-verified'), 'email-bounced'])];
          await supabase.from('prospects').update({ email: null, tags: newTags, updated_at: now }).eq('id', p.id);
          details.push({ name: `${p.first_name} ${p.last_name}`, email: p.email, result: 'undeliverable → email cleared' });
        } else {
          risky++;
          newTags = [...new Set([...newTags, result.result === 'risky' ? 'email-risky' : 'email-unverifiable'])];
          await supabase.from('prospects').update({ tags: newTags, updated_at: now }).eq('id', p.id);
          details.push({ name: `${p.first_name} ${p.last_name}`, email: p.email, result: result.result });
        }
      } catch (err) {
        failed++;
        details.push({ name: `${p.first_name} ${p.last_name}`, email: p.email ?? '', result: `error: ${String(err)}` });
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

    console.log(`[HPR hunter-verifier-prospects] ${verified} valides, ${invalid} invalides, ${risky} risqués, ${credits} crédits`);
    return NextResponse.json({ ok: true, total, processed, verified, invalid, risky, failed, credits });

  } catch (err) {
    if (taskId) {
      await supabase.from('background_tasks').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(err),
      }).eq('id', taskId);
    }
    console.error('[HPR hunter-verifier-prospects] Fatal error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
