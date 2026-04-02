export default defineNuxtRouteMiddleware((to, _from) => {
  const auth = useAuth();
  if (!auth.isLoggedIn && to.path.startsWith('/dashboard')) {
    return navigateTo('/login');
  }
});
