export async function handle({ event, resolve }) {
  const session = event.cookies.get('session');
  if (!session && event.url.pathname.startsWith('/dashboard')) {
    return new Response('Redirect', { status: 302, headers: { Location: '/login' } });
  }
  return resolve(event);
}
