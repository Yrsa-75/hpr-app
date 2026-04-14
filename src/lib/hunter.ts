/**
 * Hunter.io API client
 * Docs: https://hunter.io/api-documentation
 */

const HUNTER_BASE = 'https://api.hunter.io/v2';

export interface HunterFinderResult {
  email: string | null;
  score: number | null;
  found: boolean;
}

export interface HunterVerifierResult {
  status: 'valid' | 'invalid' | 'accept_all' | 'unknown';
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  score: number | null;
}

export async function hunterFindEmail(
  firstName: string,
  lastName: string,
  company: string
): Promise<HunterFinderResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error('HUNTER_API_KEY not configured');

  const params = new URLSearchParams({
    first_name: firstName,
    last_name: lastName,
    company,
    api_key: apiKey,
  });

  const res = await fetch(`${HUNTER_BASE}/email-finder?${params}`);
  const json = await res.json() as {
    data?: { email?: string | null; score?: number | null };
    errors?: { id: string; details: string }[];
  };

  if (json.errors?.length) {
    // No result found is not an error we want to throw
    const notFound = json.errors.some((e) => e.id === 'not_found' || e.details?.includes('No result'));
    if (notFound) return { email: null, score: null, found: false };
    throw new Error(json.errors[0].details ?? 'Hunter API error');
  }

  const email = json.data?.email ?? null;
  return {
    email,
    score: json.data?.score ?? null,
    found: !!email,
  };
}

export async function hunterVerifyEmail(
  email: string
): Promise<HunterVerifierResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error('HUNTER_API_KEY not configured');

  const params = new URLSearchParams({ email, api_key: apiKey });
  const res = await fetch(`${HUNTER_BASE}/email-verifier?${params}`);
  const json = await res.json() as {
    data?: {
      status?: string;
      result?: string;
      score?: number | null;
    };
    errors?: { id: string; details: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0].details ?? 'Hunter API error');
  }

  return {
    status: (json.data?.status as HunterVerifierResult['status']) ?? 'unknown',
    result: (json.data?.result as HunterVerifierResult['result']) ?? 'unknown',
    score: json.data?.score ?? null,
  };
}
