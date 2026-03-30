'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function verifyClippingAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { error } = await supabase
    .from('press_clippings')
    .update({ is_verified: true })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/clippings', 'page');
  return { success: true };
}

export async function deleteClippingAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { error } = await supabase
    .from('press_clippings')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/[locale]/(dashboard)/clippings', 'page');
  return { success: true };
}
