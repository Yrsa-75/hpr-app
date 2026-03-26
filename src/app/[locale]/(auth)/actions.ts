'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: getAuthErrorMessage(error.message) };
  }

  revalidatePath('/', 'layout');
  redirect('/fr/dashboard');
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const full_name = formData.get('full_name') as string;
  const organization_name = formData.get('organization_name') as string;

  // Sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        organization_name,
      },
    },
  });

  if (authError) {
    return { error: getAuthErrorMessage(authError.message) };
  }

  if (authData.user) {
    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: organization_name })
      .select()
      .single();

    if (orgError) {
      return { error: "Erreur lors de la création de l'organisation" };
    }

    // Update user with organization
    const { error: userError } = await supabase
      .from('users')
      .update({
        organization_id: org.id,
        full_name,
        role: 'admin',
      })
      .eq('id', authData.user.id);

    if (userError) {
      return { error: "Erreur lors de la mise à jour du profil" };
    }
  }

  revalidatePath('/', 'layout');
  redirect('/fr/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/fr/login');
}

function getAuthErrorMessage(message: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Email ou mot de passe incorrect',
    'Email not confirmed': "Veuillez confirmer votre email avant de vous connecter",
    'User already registered': 'Un compte existe déjà avec cet email',
    'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 6 caractères',
    'Signup requires a valid password': 'Mot de passe invalide',
    'Email rate limit exceeded': 'Trop de tentatives. Veuillez réessayer plus tard.',
  };

  return errorMap[message] || message;
}
