import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const locales = ['fr'] as const;
const defaultLocale = 'fr';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const protectedRoutes = ['/dashboard', '/clients', '/campaigns', '/journalists', '/inbox', '/clippings', '/improvements', '/settings'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle next-intl locale routing first
  const intlResponse = intlMiddleware(request);

  // Determine the locale-stripped path for route matching
  const pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/';

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  // Check if the route is an auth route
  const isAuthRoute =
    pathnameWithoutLocale.startsWith('/login') ||
    pathnameWithoutLocale.startsWith('/register');

  // Update Supabase session
  const supabaseResponse = await updateSession(request);

  // If session update resulted in a redirect, use that
  if (supabaseResponse.status === 307 || supabaseResponse.status === 302) {
    return supabaseResponse;
  }

  // Get the user from cookies
  const supabaseCookies = supabaseResponse.cookies;

  // Check auth state from cookies
  const hasSession = request.cookies.getAll().some(
    (cookie) => cookie.name.includes('auth-token') || cookie.name.includes('sb-')
  );

  if (isProtectedRoute && !hasSession) {
    const locale = pathname.split('/')[1] || defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && hasSession) {
    const locale = pathname.split('/')[1] || defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // Copy cookies from supabase response to intl response
  if (intlResponse) {
    supabaseCookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie);
    });
    return intlResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
