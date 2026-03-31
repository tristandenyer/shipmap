export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useAuth();
  if (!auth.isLoggedIn && to.path.startsWith('/dashboard')) {
    return navigateTo('/login');
  }
});
