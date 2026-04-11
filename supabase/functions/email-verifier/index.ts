// ============================================
// HPR — email-verifier Edge Function v1
// Vérifie les emails des journalistes via :
//   1. DNS MX (domaine peut recevoir des emails ?)
//   2. Catch-all detection (serveur accepte-t-il tout ?)
//   3. SMTP RCPT TO (la boîte existe-t-elle ?)
//   4. Hunter.io /email-verifier (optionnel, si HUNTER_API_KEY configuré)
//
// Tags résultats :
//   email-verified     → email confirmé valide
//   non-existent       → email rejeté par le serveur
//   unverifiable       → domaine catch-all ou serveur inaccessible
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY') ?? '';

// Nombre de journalistes à traiter par invocation
const BATCH_SIZE = 20;
// Délai entre deux SMTP checks (éviter le rate limiting)
const SMTP_DELAY_MS = 500;
// Nom affiché dans les logs EHLO
const HELO_DOMAIN = 'hermespressroom.com';
// Email expéditeur fictif pour MAIL FROM (domaine valide)
const MAIL_FROM = 'verify@hermespressroom.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ============================================
// Résolution MX via DNS-over-HTTPS (Google)
// Évite d'avoir besoin de Deno.resolveDns
// ============================================
async function getMxRecord(domain: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const answers: Array<{ data: string }> = data?.Answer ?? [];
    if (answers.length === 0) return null;

    const records = answers
      .map((a) => {
        const parts = a.data.trim().split(/\s+/);
        if (parts.length < 2) return null;
        return { priority: parseInt(parts[0]), host: parts[1].replace(/\.$/, '') };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.priority - b!.priority));

    return records[0]?.host ?? null;
  } catch {
    return null;
  }
}

// ============================================
// Lecteur de réponse SMTP multi-lignes
// "220-banner\r\n220 OK\r\n" → { code: 220 }
// ============================================
async function readSmtpResponse(
  conn: Deno.TcpConn
): Promise<{ code: number; message: string }> {
  const decoder = new TextDecoder();
  let buffer = '';
  const chunk = new Uint8Array(4096);

  try {
    for (let i = 0; i < 10; i++) {
      const n = await conn.read(chunk);
      if (n === null) break;
      buffer += decoder.decode(chunk.subarray(0, n));

      // Réponse complète = ligne sans tiret après le code (ex: "250 OK\r\n")
      const lines = buffer.split('\r\n').filter(Boolean);
      for (const line of lines) {
        if (line.length >= 3 && (line.length === 3 || line[3] === ' ')) {
          const code = parseInt(line.substring(0, 3));
          if (!isNaN(code)) {
            return { code, message: line.substring(4) };
          }
        }
      }
      if (buffer.length > 8000) break;
    }
  } catch {
    // timeout ou connection reset
  }

  return { code: 0, message: 'No response' };
}

// ============================================
// Vérification SMTP complète
// Retourne: valid | invalid | catch_all | unknown
// ============================================
async function smtpVerify(
  email: string,
  mxHost: string
): Promise<'valid' | 'invalid' | 'catch_all' | 'unknown'> {
  const isCatchAll = await checkCatchAll(mxHost);
  if (isCatchAll) return 'catch_all';

  return await smtpRcptTo(email, mxHost);
}

async function smtpRcptTo(
  email: string,
  mxHost: string
): Promise<'valid' | 'invalid' | 'unknown'> {
  let conn: Deno.TcpConn | null = null;
  const encoder = new TextEncoder();

  try {
    // Timeout global de 10s
    conn = await Promise.race([
      Deno.connect({ hostname: mxHost, port: 25 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('connect timeout')), 10_000)
      ),
    ]);

    const send = async (cmd: string) => {
      await conn!.write(encoder.encode(cmd + '\r\n'));
    };

    // Greeting
    const greeting = await readSmtpResponse(conn);
    if (greeting.code < 200 || greeting.code >= 300) return 'unknown';

    // EHLO
    await send(`EHLO ${HELO_DOMAIN}`);
    await readSmtpResponse(conn);

    // MAIL FROM
    await send(`MAIL FROM:<${MAIL_FROM}>`);
    const mailFromResp = await readSmtpResponse(conn);
    if (mailFromResp.code < 200 || mailFromResp.code >= 300) return 'unknown';

    // RCPT TO — c'est ici qu'on sait si la boîte existe
    await send(`RCPT TO:<${email}>`);
    const rcptResp = await readSmtpResponse(conn);

    // QUIT propre
    await send('QUIT').catch(() => {});

    const code = rcptResp.code;
    if (code === 250 || code === 251) return 'valid';
    if (code >= 550 && code <= 559) return 'invalid';
    return 'unknown';
  } catch {
    return 'unknown';
  } finally {
    try { conn?.close(); } catch { /* ignore */ }
  }
}

// Détection catch-all : on vérifie un email qui n'existe sûrement pas
async function checkCatchAll(mxHost: string): Promise<boolean> {
  const fakeEmail = `hpr_test_${Date.now()}@${mxHost.split('.').slice(-2).join('.')}`;
  const result = await smtpRcptTo(fakeEmail, mxHost);
  // Si le serveur accepte un email manifestement faux → catch-all
  return result === 'valid';
}

// ============================================
// Hunter.io /email-verifier (optionnel)
// ============================================
async function verifyWithHunter(
  email: string
): Promise<'valid' | 'invalid' | 'unknown'> {
  if (!HUNTER_API_KEY) return 'unknown';
  try {
    const url = new URL('https://api.hunter.io/v2/email-verifier');
    url.searchParams.set('email', email);
    url.searchParams.set('api_key', HUNTER_API_KEY);
    const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return 'unknown';
    const data = await res.json();
    const status: string = data?.data?.status ?? 'unknown';
    if (status === 'valid') return 'valid';
    if (status === 'invalid') return 'invalid';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ============================================
// Mettre à jour le journaliste selon le résultat
// ============================================
async function applyVerificationResult(
  journalistId: string,
  currentTags: string[],
  result: 'valid' | 'invalid' | 'catch_all' | 'unknown'
): Promise<void> {
  const baseTags = currentTags.filter(
    (t) => !['email-verified', 'non-existent', 'unverifiable'].includes(t)
  );

  let newTags: string[];
  let isVerified: boolean | undefined;

  if (result === 'valid') {
    newTags = [...new Set([...baseTags, 'email-verified'])];
    isVerified = true;
  } else if (result === 'invalid') {
    newTags = [...new Set([...baseTags, 'non-existent'])];
    isVerified = false;
  } else {
    // catch_all ou unknown → on note que c'est invérifiable
    newTags = [...new Set([...baseTags, 'unverifiable'])];
    isVerified = undefined;
  }

  const update: Record<string, unknown> = {
    tags: newTags,
    updated_at: new Date().toISOString(),
  };
  if (isVerified !== undefined) update.is_verified = isVerified;

  await supabase.from('journalists').update(update).eq('id', journalistId);
}

// ============================================
// Main handler
// ============================================
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = {
    processed: 0,
    verified: 0,
    invalid: 0,
    unverifiable: 0,
    unknown: 0,
    errors: [] as string[],
  };

  try {
    // Journalistes à vérifier :
    // - ont un email réel (pas noemail_)
    // - ont le tag email-pattern ou via-hunter
    // - n'ont PAS encore email-verified / non-existent / unverifiable
    const { data: journalists, error } = await supabase
      .from('journalists')
      .select('id, first_name, last_name, email, tags')
      .not('email', 'like', 'noemail_%')
      .contains('tags', ['email-pattern']) // au moins ce tag
      .not('tags', 'cs', '{"email-verified"}')
      .not('tags', 'cs', '{"non-existent"}')
      .not('tags', 'cs', '{"unverifiable"}')
      .limit(BATCH_SIZE);

    // Aussi traiter les via-hunter non vérifiés
    const { data: hunterJournalists } = await supabase
      .from('journalists')
      .select('id, first_name, last_name, email, tags')
      .not('email', 'like', 'noemail_%')
      .contains('tags', ['via-hunter'])
      .not('tags', 'cs', '{"email-verified"}')
      .not('tags', 'cs', '{"non-existent"}')
      .not('tags', 'cs', '{"unverifiable"}')
      .limit(BATCH_SIZE);

    if (error) throw error;

    const toProcess = [
      ...(journalists ?? []),
      ...(hunterJournalists ?? []),
    ].filter((j, i, arr) => arr.findIndex((x) => x.id === j.id) === i); // déduplique

    console.log(`[verifier] ${toProcess.length} journalistes à vérifier`);

    for (const journalist of toProcess) {
      const email: string = journalist.email;
      const domain = email.split('@')[1];
      const tags: string[] = journalist.tags ?? [];

      console.log(`[verifier] ${journalist.first_name} ${journalist.last_name} <${email}>`);

      try {
        // 1. Vérification MX (le domaine peut-il recevoir des emails ?)
        const mxHost = await getMxRecord(domain);
        if (!mxHost) {
          console.log(`[verifier] ${domain}: aucun enregistrement MX → non-existent`);
          await applyVerificationResult(journalist.id, tags, 'invalid');
          results.invalid++;
          results.processed++;
          continue;
        }

        // 2. SMTP RCPT TO (si Hunter pas dispo ou comme cross-check)
        let smtpResult: 'valid' | 'invalid' | 'catch_all' | 'unknown' = 'unknown';
        try {
          smtpResult = await smtpVerify(email, mxHost);
          console.log(`[verifier] SMTP ${email}: ${smtpResult}`);
        } catch (e) {
          console.log(`[verifier] SMTP error pour ${email}: ${e}`);
        }

        // 3. Hunter.io en renfort si SMTP inconclusive
        let finalResult = smtpResult;
        if ((smtpResult === 'unknown' || smtpResult === 'catch_all') && HUNTER_API_KEY) {
          const hunterResult = await verifyWithHunter(email);
          console.log(`[verifier] Hunter ${email}: ${hunterResult}`);
          if (hunterResult === 'valid') finalResult = 'valid';
          else if (hunterResult === 'invalid') finalResult = 'invalid';
        }

        await applyVerificationResult(journalist.id, tags, finalResult);

        if (finalResult === 'valid') results.verified++;
        else if (finalResult === 'invalid') results.invalid++;
        else results.unverifiable++;

        results.processed++;

        // Pause pour éviter de se faire bloquer
        await new Promise((r) => setTimeout(r, SMTP_DELAY_MS));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[verifier] Erreur ${email}: ${msg}`);
        results.errors.push(`${email}: ${msg}`);
        results.unknown++;
        results.processed++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[verifier] Erreur fatale:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
