<template>
  <div class="min-h-screen bg-gray-50">
    <nav v-if="auth.isAuthenticated.value" class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center gap-6">
            <NuxtLink to="/" class="text-xl font-bold text-indigo-600">Timesheet</NuxtLink>
            <NuxtLink to="/timesheet" class="text-sm text-gray-600 hover:text-gray-900"
              :class="{ 'text-indigo-600 font-medium': route.path.startsWith('/timesheet') }">
              My Timesheet
            </NuxtLink>
            <template v-if="auth.isAdmin.value">
              <NuxtLink to="/admin" class="text-sm text-gray-600 hover:text-gray-900"
                :class="{ 'text-indigo-600 font-medium': route.path === '/admin' }">
                Dashboard
              </NuxtLink>
              <NuxtLink to="/admin/users" class="text-sm text-gray-600 hover:text-gray-900"
                :class="{ 'text-indigo-600 font-medium': route.path.startsWith('/admin/users') }">
                Users
              </NuxtLink>
              <NuxtLink to="/admin/projects" class="text-sm text-gray-600 hover:text-gray-900"
                :class="{ 'text-indigo-600 font-medium': route.path.startsWith('/admin/projects') }">
                Projects
              </NuxtLink>
              <NuxtLink to="/admin/holidays" class="text-sm text-gray-600 hover:text-gray-900"
                :class="{ 'text-indigo-600 font-medium': route.path.startsWith('/admin/holidays') }">
                Holidays
              </NuxtLink>
            </template>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-500">{{ auth.user.value?.fullName }}</span>
            <span class="text-xs px-2 py-0.5 rounded-full"
              :class="auth.isAdmin.value ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
              {{ auth.user.value?.role }}
            </span>
            <button @click="handleLogout" class="text-sm text-red-600 hover:text-red-800">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth()
const route = useRoute()

async function handleLogout() {
  await auth.logout()
  navigateTo('/login')
}
</script>
