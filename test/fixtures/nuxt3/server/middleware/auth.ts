export default defineEventHandler((event) => {
  const token = getHeader(event, 'authorization');
  if (!token && event.path.startsWith('/api/admin')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
});
