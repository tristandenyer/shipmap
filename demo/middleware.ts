import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/users(.*)',
  '/api/chat(.*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/pricing',
  '/blog(.*)',
  '/login',
  '/register',
  '/api/health',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }

  // Redirect logged-in users away from auth pages
  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register') {
    const { userId } = auth();
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
