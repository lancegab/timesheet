export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuth()

  const publicRoutes = ['/login', '/forgot-password', '/reset-password']
  if (publicRoutes.some(r => to.path.startsWith(r))) {
    if (auth.isAuthenticated.value && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  if (!auth.isAuthenticated.value) {
    return navigateTo('/login')
  }

  // Admin routes
  if (to.path.startsWith('/admin') && !auth.isAdmin.value) {
    return navigateTo('/')
  }

  // Force password change
  if (auth.user.value?.mustChangePassword && to.path !== '/change-password') {
    return navigateTo('/change-password')
  }
})
