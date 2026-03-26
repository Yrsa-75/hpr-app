import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LocaleRootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/fr/dashboard');
  } else {
    redirect('/fr/login');
  }
}
