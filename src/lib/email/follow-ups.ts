/**
 * Relances automatiques J+4 / J+8 aux non-répondants délivrés.
 *
 * Mécanique (brief RP 2026-07-09 §6b/§6f) :
 * - Relance 1 (J+4) : envoi délivré/ouvert/cliqué il y a ≥ 4 jours,
 *   aucune réponse (pas de thread), aucune relance déjà faite.
 * - Relance 2 (J+8) : relance 1 envoyée il y a ≥ 4 jours, toujours
 *   aucune réponse. Maximum 2 relances, jamais plus.
 * - Borne d'ancienneté : au-delà de MAX_RELANCE_AGE_DAYS, un envoi (ou une
 *   relance 1) n'est plus relançable — évite de « relancer » des campagnes
 *   vieilles de plusieurs mois avec un texte qui parle de quelques jours.
 * - Jamais d'envoi le week-end : la planification tourne tous les jours,
 *   mais l'envoi effectif est reporté au lundi (consigne 2026-07-15).
 *
 * Garde-fous :
 * - journaliste opt-out ou non envoyable (miroir du trigger anti-bounce) → exclu
 * - une réponse (email_threads) à n'importe quel moment stoppe la séquence
 * - le replyTo reprend l'envoi d'origine : une réponse à la relance crée le
 *   thread normalement et coupe la suite
 *
 * Déploiement progressif : la planification tourne toujours ; l'ENVOI n'a lieu
 * que si FOLLOW_UPS_AUTOSEND === 'true' (validation du 1er batch par Julien
 * avant activation).
 */

import { sendBlockReason } from '@/lib/journalists/sendable';

const RELANCE_DELAY_DAYS = 4;
// Marge sur le cutoff J+4 : le cron tourne à 09:00 UTC mais les envois du
// batch précédent portent des sent_at à 09:00:48-09:01:21 — comparés à la
// seconde près, ils rataient le run du 4e jour et glissaient au lendemain
// (constat du 2026-07-15 sur les relances TDF/PQR).
const CUTOFF_TOLERANCE_MIN = 15;
// Borne haute : un envoi plus ancien n'est plus relançable — le template dit
// « il y a quelques jours », faux au-delà (418 envois d'avril/mai auraient été
// relancés sans ce garde-fou, constat du 2026-07-09).
const MAX_RELANCE_AGE_DAYS = 21;
// 50 → 100 le 2026-07-15 : regroupement du calendrier (88 relances 2 TDF+PQR
// doivent partir en un seul run le 16/07). Le quota Resend ~100/jour reste la
// borne réelle ; SEND_DELAY_MS lisse le débit pour éviter les 429 en rafale.
const MAX_FOLLOW_UPS_PER_RUN = 100;
const SEND_DELAY_MS = 600;

export type FollowUpsResult = {
  scheduled: number;
  sent: number;
  skipped: number;
  autosend: boolean;
  errors: string[];
};

interface JournalistLite {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  media_outlet: string | null;
  tags: string[] | null;
  is_opted_out: boolean;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Cutoff J+4 avec marge : « il y a 4 jours moins 15 minutes »
function relanceCutoffIso(): string {
  const ms = (RELANCE_DELAY_DAYS * 24 * 60 - CUTOFF_TOLERANCE_MIN) * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

// Les relances ne partent jamais le week-end : personne ne lit la presse
// pro le samedi (consigne du 2026-07-15). La planification tourne, l'envoi
// reprend au run du lundi.
function isWeekend(): boolean {
  const day = new Date().getUTCDay(); // cron à 09:00 UTC : jour UTC = jour Paris
  return day === 0 || day === 6;
}

// ============================================
// Contenu des relances (template déterministe)
// ============================================
function buildFollowUpHtml(params: {
  sequence: number;
  journalistFirstName: string;
  prTitle: string;
  campaignIntro: string | null;
  mediaPackUrl: string | null;
  signature: string;
  unsubscribeUrl: string;
}): string {
  const { sequence, journalistFirstName, prTitle, campaignIntro, mediaPackUrl, signature, unsubscribeUrl } = params;

  // Accroche personnalisée par campagne (campaigns.follow_up_intro),
  // ex : "Le Tour roule encore jusqu'à dimanche — c'est le moment idéal
  // pour parler de LifeStick à vos lecteurs."
  const intro = campaignIntro?.trim()
    ? `<p><em>${campaignIntro.trim()}</em></p>`
    : '';

  const body =
    sequence === 1
      ? `<p>Bonjour ${journalistFirstName},</p>
${intro}<p>Je me permets de revenir vers vous au sujet du communiqué « <strong>${prTitle}</strong> » que je vous ai adressé il y a quelques jours.</p>
<p>Si le sujet retient votre attention, je peux vous proposer :</p>
<ul>
  <li>une <strong>interview du fondateur</strong>, aux disponibilités souples ;</li>
  <li>des <strong>visuels HD et informations complémentaires</strong> pour illustrer un article${mediaPackUrl ? ` (<a href="${mediaPackUrl}">pack média téléchargeable ici</a>)` : ''} ;</li>
  <li>tout élément d'angle spécifique à votre rédaction.</li>
</ul>
<p>Je reste à votre disposition,</p>`
      : `<p>Bonjour ${journalistFirstName},</p>
${intro}<p>N'hésitez pas à me demander plus d'informations.</p>
<p>Si le sujet peut intéresser votre rédaction, même plus tard dans la saison, un simple mot suffit et je vous renvoie les éléments (interview, visuels${mediaPackUrl ? `, <a href="${mediaPackUrl}">pack média</a>` : ''}).</p>
<p>Bien cordialement,</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 640px; margin: 0 auto; padding: 28px 24px; color: #1a1a1a; background: #ffffff; }
    p { font-size: 15px; line-height: 1.7; margin: 0 0 14px; color: #333; }
    ul { padding-left: 20px; margin: 0 0 14px; }
    li { font-size: 15px; line-height: 1.7; color: #333; margin-bottom: 4px; }
    strong { font-weight: 700; color: #111; }
    a { color: #b8860b; }
    .signature { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e5e5e5; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; text-align: center; }
    .unsubscribe-btn { display: inline-block; margin-top: 8px; padding: 6px 16px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; color: #6b7280; text-decoration: none; }
  </style>
</head>
<body>
  ${body}
  ${signature ? `<div class="signature">${signature}</div>` : ''}
  <div class="footer">
    Vous recevez ce message en tant que journaliste professionnel.<br>
    <a href="${unsubscribeUrl}" class="unsubscribe-btn">Se désinscrire</a>
  </div>
</body>
</html>`;
}

// ============================================
// Étape 1 : planifier les relances dues
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scheduleDueFollowUps(supabase: any): Promise<{ scheduled: number; skipped: number }> {
  let scheduled = 0;
  let skipped = 0;

  const cutoff = relanceCutoffIso();
  const maxAge = daysAgoIso(MAX_RELANCE_AGE_DAYS);

  // --- Relance 1 (J+4) : envois délivrés sans réponse ni relance ---
  const { data: candidateSends } = await supabase
    .from('email_sends')
    .select('id, campaign_id, journalist_id, press_release_id, personalized_subject, sent_at, campaigns(status), journalists(id, first_name, last_name, email, media_outlet, tags, is_opted_out)')
    .in('status', ['delivered', 'opened', 'clicked'])
    .not('journalist_id', 'is', null)
    .lte('sent_at', cutoff)
    .gte('sent_at', maxAge)
    .order('sent_at', { ascending: true })
    .limit(300);

  for (const send of candidateSends ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campaign = (send as any).campaigns as { status: string } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const journalist = (send as any).journalists as JournalistLite | null;

    if (!campaign || ['draft', 'paused', 'archived'].includes(campaign.status)) continue;
    if (!journalist?.email || journalist.is_opted_out || sendBlockReason(journalist.tags)) {
      skipped++;
      continue;
    }

    // A répondu ? (un thread existe pour ce couple campagne/journaliste)
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('campaign_id', send.campaign_id)
      .eq('journalist_id', send.journalist_id)
      .limit(1)
      .maybeSingle();
    if (thread) continue;

    // Déjà relancé ?
    const { data: existingFu } = await supabase
      .from('follow_ups')
      .select('id')
      .eq('campaign_id', send.campaign_id)
      .eq('journalist_id', send.journalist_id)
      .limit(1)
      .maybeSingle();
    if (existingFu) continue;

    const { error } = await supabase.from('follow_ups').insert({
      thread_id: null,
      campaign_id: send.campaign_id,
      journalist_id: send.journalist_id,
      email_send_id: send.id,
      type: 'auto_scheduled',
      status: 'scheduled',
      sequence: 1,
      scheduled_at: new Date().toISOString(),
      ai_rationale: `Relance automatique J+${RELANCE_DELAY_DAYS} : envoi délivré le ${send.sent_at}, aucune réponse.`,
    });
    if (!error) scheduled++;
  }

  // --- Relance 2 (J+8) : relance 1 envoyée il y a ≥ 4 jours, toujours rien ---
  const { data: sentFirstFollowUps } = await supabase
    .from('follow_ups')
    .select('id, campaign_id, journalist_id, email_send_id, sent_at')
    .eq('status', 'sent')
    .eq('sequence', 1)
    .lte('sent_at', cutoff)
    .gte('sent_at', maxAge)
    .limit(300);

  for (const fu of sentFirstFollowUps ?? []) {
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('campaign_id', fu.campaign_id)
      .eq('journalist_id', fu.journalist_id)
      .limit(1)
      .maybeSingle();
    if (thread) continue;

    const { data: existingSecond } = await supabase
      .from('follow_ups')
      .select('id')
      .eq('campaign_id', fu.campaign_id)
      .eq('journalist_id', fu.journalist_id)
      .eq('sequence', 2)
      .limit(1)
      .maybeSingle();
    if (existingSecond) continue;

    // Le journaliste est-il toujours envoyable ? (bounce entre-temps, etc.)
    const { data: journalist } = await supabase
      .from('journalists')
      .select('id, email, tags, is_opted_out')
      .eq('id', fu.journalist_id)
      .maybeSingle();
    if (!journalist?.email || journalist.is_opted_out || sendBlockReason(journalist.tags)) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('follow_ups').insert({
      thread_id: null,
      campaign_id: fu.campaign_id,
      journalist_id: fu.journalist_id,
      email_send_id: fu.email_send_id,
      type: 'auto_scheduled',
      status: 'scheduled',
      sequence: 2,
      scheduled_at: new Date().toISOString(),
      ai_rationale: `Relance automatique J+${RELANCE_DELAY_DAYS * 2} : relance 1 envoyée le ${fu.sent_at}, toujours aucune réponse. Dernière relance.`,
    });
    if (!error) scheduled++;
  }

  return { scheduled, skipped };
}

// ============================================
// Étape 2 : envoyer les relances planifiées
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processScheduledFollowUps(supabase: any): Promise<{ sent: number; skipped: number; errors: string[] }> {
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: 0, skipped: 0, errors: ['Clé API Resend non configurée'] };

  const { data: dueFollowUps } = await supabase
    .from('follow_ups')
    .select('id, campaign_id, journalist_id, email_send_id, sequence, campaigns(client_id, follow_up_intro, clients(name, slug, sender_name, sender_email, email_signature_html)), journalists(first_name, last_name, email, tags, is_opted_out)')
    .eq('status', 'scheduled')
    .eq('type', 'auto_scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(MAX_FOLLOW_UPS_PER_RUN);

  if (!dueFollowUps || dueFollowUps.length === 0) return { sent: 0, skipped: 0, errors: [] };

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hermespressroom.com';
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN ?? 'intvare.resend.app';

  for (const fu of dueFollowUps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campaign = (fu as any).campaigns;
    const client = campaign?.clients;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const journalist = (fu as any).journalists as JournalistLite | null;

    // Re-vérification finale avant envoi (réponse arrivée entre-temps, bounce…)
    if (!journalist?.email || journalist.is_opted_out || sendBlockReason(journalist.tags)) {
      await supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', fu.id);
      skipped++;
      continue;
    }
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('campaign_id', fu.campaign_id)
      .eq('journalist_id', fu.journalist_id)
      .limit(1)
      .maybeSingle();
    if (thread) {
      await supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', fu.id);
      skipped++;
      continue;
    }

    const fromEmail = client?.sender_email;
    const fromName = client?.sender_name ?? client?.name;
    if (!fromEmail) {
      errors.push(`Expéditeur non configuré (follow_up ${fu.id})`);
      skipped++;
      continue;
    }

    // Sujet + titre du CP depuis l'envoi d'origine
    const { data: originalSend } = await supabase
      .from('email_sends')
      .select('id, personalized_subject, press_releases(title, email_subject)')
      .eq('id', fu.email_send_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr = (originalSend as any)?.press_releases as { title: string | null; email_subject: string | null } | null;
    const originalSubject = originalSend?.personalized_subject ?? pr?.email_subject ?? pr?.title ?? 'notre communiqué';
    const prTitle = pr?.title ?? originalSubject;

    const mediaPackUrl = client?.slug ? `${appUrl}/media/${client.slug}` : null;
    const unsubscribeUrl = `${appUrl}/unsubscribe?send=${fu.email_send_id}`;

    const html = buildFollowUpHtml({
      sequence: fu.sequence,
      journalistFirstName: journalist.first_name,
      prTitle,
      campaignIntro: campaign?.follow_up_intro ?? null,
      mediaPackUrl,
      signature: client?.email_signature_html ?? '',
      unsubscribeUrl,
    });

    try {
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: journalist.email,
        replyTo: `reply+${fu.email_send_id}@${inboundDomain}`,
        subject: `Re: ${originalSubject}`,
        html,
        headers: {
          'X-Campaign-Id': fu.campaign_id,
          'X-Follow-Up-Id': fu.id,
        },
      });

      if (result.error) {
        const msg = JSON.stringify(result.error);
        if (msg.toLowerCase().includes('rate') || msg.includes('429')) {
          // Quota Resend atteint — on laisse le reste en 'scheduled' pour demain
          errors.push('Quota Resend atteint — relances restantes reportées au lendemain');
          break;
        }
        errors.push(`Resend error (follow_up ${fu.id}): ${msg}`);
        skipped++;
      } else {
        sent++;
        await supabase.from('follow_ups').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          content_html: html,
          // Sans cet ID, le webhook Resend ne peut pas raccrocher les
          // événements delivered/opened/clicked (constat du 2026-07-16).
          resend_email_id: result.data?.id ?? null,
          delivery_status: 'sent',
        }).eq('id', fu.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('rate') || msg.includes('429')) {
        errors.push('Quota Resend atteint — relances restantes reportées au lendemain');
        break;
      }
      errors.push(`Exception (follow_up ${fu.id}): ${msg}`);
      skipped++;
    }

    // Lisse le débit : l'API Resend limite à ~2 req/s, un batch de 100 en
    // rafale déclencherait des 429 (et le report au lendemain).
    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  return { sent, skipped, errors };
}

// ============================================
// Backfill : raccrocher les relances orphelines à leur email Resend
// ============================================
// Les relances envoyées avant le 2026-07-16 n'ont pas de resend_email_id :
// on relit l'historique Resend (emails.list) et on re-matche chaque relance
// par l'UUID de l'envoi d'origine présent dans le reply_to
// (reply+<email_send_id>@…) + la proximité de la date d'envoi (l'envoi
// initial partage le même reply_to mais date d'un autre jour). No-op dès
// qu'il n'y a plus d'orpheline. Limite : la rétention des logs Resend ;
// au-delà, l'événement est perdu et la relance reste 'sent'.

export type FollowUpBackfillResult = {
  orphans: number;
  matched: number;
  updated: number;
  pages: number;
  errors: string[];
};

// Resend renvoie parfois des timestamps façon Postgres ("2026-07-15 12:10:41.307+00")
function parseResendTs(s: string): number {
  let t = Date.parse(s);
  if (Number.isNaN(t)) t = Date.parse(s.replace(' ', 'T').replace(/\+00$/, 'Z'));
  return t;
}

const BACKFILL_MATCH_TOLERANCE_MS = 30 * 60 * 1000;
const BACKFILL_MAX_PAGES = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function backfillFollowUpTracking(supabase: any): Promise<FollowUpBackfillResult> {
  const errors: string[] = [];

  const { data: orphans } = await supabase
    .from('follow_ups')
    .select('id, email_send_id, sent_at')
    .eq('status', 'sent')
    .is('resend_email_id', null)
    .not('sent_at', 'is', null);

  if (!orphans || orphans.length === 0) {
    return { orphans: 0, matched: 0, updated: 0, pages: 0, errors };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { orphans: orphans.length, matched: 0, updated: 0, pages: 0, errors: ['Clé API Resend non configurée'] };
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const oldestOrphanMs = Math.min(
    ...orphans.map((o: { sent_at: string }) => new Date(o.sent_at).getTime())
  );

  // On remonte le journal Resend (du plus récent au plus ancien) jusqu'à
  // dépasser la plus vieille relance orpheline.
  type ListedEmail = {
    id: string;
    reply_to: string[] | null;
    created_at: string;
    last_event: string;
  };
  const emails: ListedEmail[] = [];
  let after: string | undefined;
  let pages = 0;

  while (pages < BACKFILL_MAX_PAGES) {
    const res = await resend.emails.list(after ? { limit: 100, after } : { limit: 100 });
    if (res.error) {
      errors.push(`Resend list error: ${JSON.stringify(res.error)}`);
      break;
    }
    const batch = (res.data?.data ?? []) as ListedEmail[];
    emails.push(...batch);
    pages++;
    if (batch.length === 0 || !res.data?.has_more) break;
    const oldestInBatch = parseResendTs(batch[batch.length - 1].created_at);
    if (oldestInBatch < oldestOrphanMs - 60 * 60 * 1000) break;
    after = batch[batch.length - 1].id;
    // Rate limit Resend ~2 req/s
    await new Promise((r) => setTimeout(r, 600));
  }

  const eventToDelivery: Record<string, string> = {
    delivered: 'delivered',
    opened: 'opened',
    clicked: 'clicked',
    bounced: 'bounced',
    complained: 'complained',
  };

  let matched = 0;
  let updated = 0;

  for (const fu of orphans) {
    const sentMs = new Date(fu.sent_at).getTime();
    const candidate = emails.find(
      (e) =>
        e.reply_to?.some((r) => r.includes(fu.email_send_id)) &&
        Math.abs(parseResendTs(e.created_at) - sentMs) < BACKFILL_MATCH_TOLERANCE_MS
    );
    if (!candidate) continue;
    matched++;

    const delivery = eventToDelivery[candidate.last_event] ?? 'sent';
    const updates: Record<string, unknown> = {
      resend_email_id: candidate.id,
      delivery_status: delivery,
    };
    // Le journal ne donne que le dernier événement, pas ses horodatages :
    // opened_at/clicked_at restent null pour ces relances rattrapées.
    if (delivery === 'bounced') updates.bounced_at = fu.sent_at;

    const { error } = await supabase.from('follow_ups').update(updates).eq('id', fu.id);
    if (error) errors.push(`Update follow_up ${fu.id}: ${error.message}`);
    else updated++;
  }

  return { orphans: orphans.length, matched, updated, pages, errors };
}

// ============================================
// Point d'entrée (appelé par le cron batch-sender)
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runFollowUps(supabase: any): Promise<FollowUpsResult> {
  const autosend = process.env.FOLLOW_UPS_AUTOSEND === 'true';

  const { scheduled, skipped: scheduleSkipped } = await scheduleDueFollowUps(supabase);

  if (!autosend) {
    // Mode validation : on planifie mais on n'envoie pas.
    // Activer avec FOLLOW_UPS_AUTOSEND=true dans l'env Vercel après revue.
    return { scheduled, sent: 0, skipped: scheduleSkipped, autosend: false, errors: [] };
  }

  if (isWeekend()) {
    // Planifié mais pas envoyé : le run du lundi reprendra la file.
    return {
      scheduled,
      sent: 0,
      skipped: scheduleSkipped,
      autosend: true,
      errors: ['Week-end : envoi des relances reporté au lundi'],
    };
  }

  const { sent, skipped: sendSkipped, errors } = await processScheduledFollowUps(supabase);
  return { scheduled, sent, skipped: scheduleSkipped + sendSkipped, autosend: true, errors };
}
