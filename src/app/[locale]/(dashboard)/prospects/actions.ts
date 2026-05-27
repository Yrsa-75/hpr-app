'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const prospectSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est obligatoire'),
  last_name: z.string().min(1, 'Le nom est obligatoire'),
  company: z.string().min(1, "L'entreprise est obligatoire"),
  email: z.union([z.string().email('Email invalide'), z.literal('')]).optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  sector: z.string().optional(),
  linkedin_url: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || /^https?:\/\/.+/.test(val),
      { message: 'URL invalide (doit commencer par http:// ou https://)' }
    ),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export type ProspectFormState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type ProspectImport = {
  first_name: string;
  last_name: string;
  company: string;
  email?: string;
  phone?: string;
  role?: string;
  sector?: string;
  linkedin_url?: string;
  notes?: string;
  tags?: string;
  validate?: string;
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

export async function createProspectAction(
  formData: FormData
): Promise<ProspectFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Non autorisé' };
  }

  const raw = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    company: formData.get('company') as string,
    email: (formData.get('email') as string) || undefined,
    phone: (formData.get('phone') as string) || undefined,
    role: (formData.get('role') as string) || undefined,
    sector: (formData.get('sector') as string) || undefined,
    linkedin_url: (formData.get('linkedin_url') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    tags: (formData.get('tags') as string) || undefined,
  };

  const parsed = prospectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { error } = await supabase.from('prospects').insert({
    organization_id: organizationId,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    company: parsed.data.company,
    email: parsed.data.email || null,
    phone: parsed.data.phone ?? null,
    role: parsed.data.role ?? null,
    sector: parsed.data.sector ?? null,
    linkedin_url: parsed.data.linkedin_url || null,
    notes: parsed.data.notes ?? null,
    tags: parseCommaSeparated(parsed.data.tags),
  });

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Un prospect avec cet email existe déjà.' };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/prospects', 'page');
  return { success: true };
}

export async function updateProspectAction(
  id: string,
  formData: FormData
): Promise<ProspectFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Non autorisé' };
  }

  const raw = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    company: formData.get('company') as string,
    email: (formData.get('email') as string) || undefined,
    phone: (formData.get('phone') as string) || undefined,
    role: (formData.get('role') as string) || undefined,
    sector: (formData.get('sector') as string) || undefined,
    linkedin_url: (formData.get('linkedin_url') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    tags: (formData.get('tags') as string) || undefined,
  };

  const parsed = prospectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Données invalides',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { error } = await supabase
    .from('prospects')
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      company: parsed.data.company,
      email: parsed.data.email || null,
      phone: parsed.data.phone ?? null,
      role: parsed.data.role ?? null,
      sector: parsed.data.sector ?? null,
      linkedin_url: parsed.data.linkedin_url || null,
      notes: parsed.data.notes ?? null,
      tags: parseCommaSeparated(parsed.data.tags),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Un prospect avec cet email existe déjà.' };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/prospects', 'page');
  return { success: true };
}

export async function deleteProspectAction(
  id: string
): Promise<ProspectFormState> {
  const supabase = await createClient();

  const organizationId = await getOrganizationId(supabase);
  if (!organizationId) {
    return { success: false, error: 'Non autorisé' };
  }

  const { error } = await supabase
    .from('prospects')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/[locale]/(dashboard)/prospects', 'page');
  return { success: true };
}

export async function importProspectsAction(
  prospects: ProspectImport[]
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

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    const rowNum = i + 2;
    const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || `Ligne ${rowNum}`;
    const email = prospect.email ?? '';

    if (!prospect.first_name?.trim()) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: 'Prénom manquant' });
      continue;
    }
    if (!prospect.last_name?.trim()) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: 'Nom manquant' });
      continue;
    }
    if (!prospect.company?.trim()) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: "Nom de l'entreprise manquant" });
      continue;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (prospect.email?.trim() && !emailRegex.test(prospect.email.trim())) {
      errors++;
      errorDetails.push({ row: rowNum, name, email, reason: `Email invalide : "${prospect.email}"` });
      continue;
    }

    const { error } = await supabase.from('prospects').insert({
      organization_id: organizationId,
      first_name: prospect.first_name.trim(),
      last_name: prospect.last_name.trim(),
      company: prospect.company.trim(),
      email: prospect.email?.trim().toLowerCase() || null,
      phone: prospect.phone?.trim() || null,
      role: prospect.role?.trim() || null,
      sector: prospect.sector?.trim() || null,
      linkedin_url: prospect.linkedin_url?.trim() || null,
      notes: prospect.notes?.trim() || null,
      tags: (() => {
        const base = parseImportSeparated(prospect.tags) ?? [];
        if (prospect.validate?.trim() && !base.includes('validate')) {
          return ['validate', ...base];
        }
        return base.length ? base : null;
      })(),
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

  revalidatePath('/[locale]/(dashboard)/prospects', 'page');
  return { success: true, imported, skipped, errors, errorDetails };
}
