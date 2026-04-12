'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const mediaTypeEnum = z.enum([
  'presse_ecrite',
  'tv',
  'radio',
  'web',
  'podcast',
  'blog',
  'influenceur',
]);

const journalistSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est obligatoire'),
  last_name: z.string().min(1, 'Le nom est obligatoire'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  media_outlet: z.string().optional(),
  media_type: mediaTypeEnum.optional(),
  beat: z.string().optional(), // comma-separated
  location: z.string().optional(),
  linkedin_url: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().url('URL LinkedIn invalide').optional()),
  twitter_handle: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(), // comma-separated
});

export type JournalistFormState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type JournalistImport = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  phone_direct?: string;
  media_outlet?: string;
  media_type?: string;
  beat?: string;
  location?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  notes?: string;
  tags?: string;
};

export type ImportError = {
  row: number;
  name: string;
  email: string;
  reason: string;
};

export type ImportResult = {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  errorDetails: ImportError[];
  error?: string;
};

function parseCommaSeparated(val: string | undefined): string[] | null {
  if (!val || val.trim() === '') return null;
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// For CSV imports: accepts both / and , as separators
function parseImportSeparated(val: string | undefined): string[] | null {
  if (!val || val.trim() === '') return null;
  return val
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  return profile?.organization_id ?? null;
}

export async function createJournalistAction(
  formData: FormData
): Promise<JournalistFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Non autorisé' };
  }

  const raw = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || undefined,
    media_outlet: (formData.get('media_outlet') as string) || undefined,
    media_type: (formData.get('media_type') as string) || undefined,
    beat: (formData.get('beat') as string) || undefined,
    location: (formData.get('location') as string) || undefined,
    linkedin_url: (formData.get('linkedin_url') as string) || undefined,
    twitter_handle: (formData.get('twitter_handle') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    tags: (formData.get('tags') as string) || undefined,
  };

  const parsed = journalistSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { data: d, error } = await supabase.from('journalists').insert({
    organization_id: organizationId,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    media_outlet: parsed.data.media_outlet ?? null,
    media_type: parsed.data.media_type ?? null,
    beat: parseCommaSeparated(parsed.data.beat),
    location: parsed.data.location ?? null,
    linkedin_url: parsed.data.linkedin_url ?? null,
    twitter_handle: parsed.data.twitter_handle ?? null,
    notes: parsed.data.notes ?? null,
    tags: parseCommaSeparated(parsed.data.tags),
  });

  void d;

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        error: 'Un journaliste avec cet email existe déjà dans votre base.',
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/journalists', 'page');
  return { success: true };
}

export async function updateJournalistAction(
  id: string,
  formData: FormData
): Promise<JournalistFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Non autorisé' };
  }

  const raw = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || undefined,
    media_outlet: (formData.get('media_outlet') as string) || undefined,
    media_type: (formData.get('media_type') as string) || undefined,
    beat: (formData.get('beat') as string) || undefined,
    location: (formData.get('location') as string) || undefined,
    linkedin_url: (formData.get('linkedin_url') as string) || undefined,
    twitter_handle: (formData.get('twitter_handle') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    tags: (formData.get('tags') as string) || undefined,
  };

  const parsed = journalistSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { error } = await supabase
    .from('journalists')
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      media_outlet: parsed.data.media_outlet ?? null,
      media_type: parsed.data.media_type ?? null,
      beat: parseCommaSeparated(parsed.data.beat),
      location: parsed.data.location ?? null,
      linkedin_url: parsed.data.linkedin_url ?? null,
      twitter_handle: parsed.data.twitter_handle ?? null,
      notes: parsed.data.notes ?? null,
      tags: parseCommaSeparated(parsed.data.tags),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        error: 'Un journaliste avec cet email existe déjà dans votre base.',
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/journalists', 'page');
  return { success: true };
}

export async function bulkAddTagAction(
  ids: string[],
  tag: string
): Promise<{ success: boolean; updated: number; error?: string }> {
  if (!ids.length) return { success: true, updated: 0 };

  const supabase = await createClient();
  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) return { success: false, updated: 0, error: 'Non autorisé' };

  // Fetch current tags for selected journalists in one query
  const { data: rows, error: fetchError } = await supabase
    .from('journalists')
    .select('id, tags')
    .in('id', ids)
    .eq('organization_id', organizationId);

  if (fetchError || !rows) {
    return { success: false, updated: 0, error: fetchError?.message ?? 'Erreur de lecture' };
  }

  let updated = 0;
  await Promise.all(
    rows.map(async (journalist) => {
      const currentTags = journalist.tags ?? [];
      if (currentTags.includes(tag)) return; // already has the tag
      const { error } = await supabase
        .from('journalists')
        .update({ tags: [...currentTags, tag], updated_at: new Date().toISOString() })
        .eq('id', journalist.id)
        .eq('organization_id', organizationId);
      if (!error) updated++;
    })
  );

  revalidatePath('/[locale]/(dashboard)/journalists', 'page');
  return { success: true, updated };
}

export async function deleteJournalistAction(
  id: string
): Promise<JournalistFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Non autorisé' };
  }

  const { error } = await supabase
    .from('journalists')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/journalists', 'page');
  return { success: true };
}

export async function importJournalistsAction(
  journalists: JournalistImport[]
): Promise<ImportResult> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, imported: 0, skipped: 0, errors: 0, errorDetails: [], error: 'Non autorisé' };
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: ImportError[] = [];

  for (let i = 0; i < journalists.length; i++) {
    const journalist = journalists[i];
    const rowNum = i + 2; // +2 because row 1 is header
    const name = [journalist.first_name, journalist.last_name].filter(Boolean).join(' ') || `Ligne ${rowNum}`;
    const email = journalist.email ?? '';

    // Basic validation
    if (!journalist.first_name?.trim()) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: 'Prénom manquant' });
      continue;
    }
    if (!journalist.last_name?.trim()) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: 'Nom manquant' });
      continue;
    }
    if (!journalist.email?.trim()) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: 'Email manquant' });
      continue;
    }
    if (!journalist.media_outlet?.trim()) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: 'Nom du média manquant' });
      continue;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(journalist.email.trim())) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: `Email invalide : "${journalist.email}"` });
      continue;
    }

    // Validate media_type — supports multiple values separated by / or , (first valid one is used)
    const validMediaTypes = ['presse_ecrite', 'tv', 'radio', 'web', 'podcast', 'blog', 'influenceur'];
    const rawMediaTypes = parseImportSeparated(journalist.media_type) ?? [];
    const mediaType = (rawMediaTypes.map((t) => t.toLowerCase().trim()).find((t) => validMediaTypes.includes(t)) ?? null) as
      | 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'influenceur'
      | null;

    const { error } = await supabase.from('journalists').insert({
      organization_id: organizationId,
      first_name: journalist.first_name.trim(),
      last_name: journalist.last_name.trim(),
      email: journalist.email.trim().toLowerCase(),
      phone: journalist.phone?.trim() || null,
      phone_direct: journalist.phone_direct?.trim() || null,
      media_outlet: journalist.media_outlet?.trim() || null,
      media_type: mediaType,
      beat: parseImportSeparated(journalist.beat),
      location: journalist.location?.trim() || null,
      linkedin_url: journalist.linkedin_url?.trim() || null,
      twitter_handle: journalist.twitter_handle?.trim() || null,
      notes: journalist.notes?.trim() || null,
      tags: parseImportSeparated(journalist.tags),
    });

    if (error) {
      if (error.code === '23505') {
        skipped++;
      } else {
        errors++;
        errorDetails.push({ row: rowNum, name, email, reason: error.message });
      }
    } else {
      imported++;
    }
  }

  revalidatePath('/[locale]/(dashboard)/journalists', 'page');
  return { success: true, imported, skipped, errors, errorDetails };
}
