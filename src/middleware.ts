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
  '/campaigns',
  '/press-releases',
  '/journalists',
  '/inbox',
  '/clippings',
  '/improvements',
  '/settings',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
