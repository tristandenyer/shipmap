import { defineMiddleware } from 'astro/middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('token');
  if (!token && context.url.pathname.startsWith('/dashboard')) {
    return context.redirect('/login');
  }
  return next();
});
