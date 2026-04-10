import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const locales = ['fr'] as const;
const defaultLocale = 'fr';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const protectedPaths = [
  '/dashboard',
  '/clients',
  '/journalists',
  '/inbox',
  '/improvements',
  '/settings',
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl;

  // Public media pack pages — no auth, no intl redirect
  if (pathname.startsWith('/media/')) {
    return NextResponse.next();
  }

  // Forward Supabase auth codes (from password reset / magic link emails) to the callback handler
  const code = searchParams.get('code');
  if (code && !pathname.startsWith('/api/auth/')) {
    const callbackUrl = new URL('/api/auth/callback', origin);
    callbackUrl.searchParams.set('code', code);
    // If this looks like a recovery flow (came from root or reset-password path), keep destination
    const isRecovery = pathname === '/' || pathname.match(/^\/[a-z]{2}(\/reset-password)?$/);
    if (isRecovery) {
      callbackUrl.searchParams.set('next', '/fr/reset-password');
    }
    return NextResponse.redirect(callbackUrl);
  }

  // Strip locale prefix (e.g. /fr/dashboard → /dashboard)
  const pathnameWithoutLocale =
    pathname.replace(/^\/[a-z]{2}(\/|$)/, '/').replace(/\/$/, '') || '/';

  const isProtectedRoute = protectedPaths.some(
    (path) =>
      pathnameWithoutLocale === path ||
      pathnameWithoutLocale.startsWith(path + '/')
  );

  const isAuthRoute =
    pathnameWithoutLocale === '/login' ||
    pathnameWithoutLocale === '/register';

  // Build response and Supabase client for session refresh
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Verify session — this also refreshes expired tokens
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = pathname.split('/')[1] || defaultLocale;

  // Unauthenticated → redirect to login
  if (isProtectedRoute && !user) {
    const url = new URL(`/${locale}/login`, request.url);
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Already authenticated → redirect away from auth pages
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // Apply next-intl locale routing
  const intlResponse = intlMiddleware(request);

  // Forward session cookies to the intl response
  if (intlResponse) {
    response.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie);
    });
    return intlResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
