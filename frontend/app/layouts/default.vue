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
            <NuxtLink to="/leave" class="text-sm text-gray-600 hover:text-gray-900"
              :class="{ 'text-indigo-600 font-medium': route.path.startsWith('/leave') }">
              Leave
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
              <NuxtLink to="/admin/time-entries" class="text-sm text-gray-600 hover:text-gray-900"
                :class="{ 'text-indigo-600 font-medium': route.path.startsWith('/admin/time-entries') }">
                Member Hours
              </NuxtLink>
              <NuxtLink to="/admin/leave-requests" class="text-sm text-gray-600 hover:text-gray-900"
                :class="{ 'text-indigo-600 font-medium': route.path.startsWith('/admin/leave-requests') }">
                Leave Requests
              </NuxtLink>
            </template>
          </div>
          <div class="flex items-center gap-4">
            <!-- Clock Widget -->
            <div v-if="clockState.active.value" class="flex items-center gap-2">
              <span class="text-sm font-mono font-bold text-red-600">{{ clockState.formatElapsed(clockState.elapsed.value) }}</span>
              <button @click="openClockOut"
                class="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-medium">
                Clock Out
              </button>
            </div>
            <button v-else @click="handleClockIn"
              class="px-3 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-medium">
              Clock In
            </button>

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

    <!-- Auto-closed session banner -->
    <div v-if="clockState.autoClosedSession.value" class="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div class="max-w-7xl mx-auto flex justify-between items-center">
        <p class="text-sm text-amber-800">
          Your clock session was auto-closed after 8 hours. Please update the time entry with the correct project and description.
        </p>
        <button @click="clockState.dismissAutoClosed()" class="text-amber-600 hover:text-amber-800 text-sm font-medium">Dismiss</button>
      </div>
    </div>

    <!-- Clock Out Modal -->
    <div v-if="showClockOut" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Clock Out</h2>
        <form @submit.prevent="handleClockOut" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select v-model="clockOutForm.projectId" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Select project</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="clockOutForm.description" rows="3" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="What did you work on?"></textarea>
          </div>
          <div v-if="clockError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ clockError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showClockOut = false"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium">Clock Out</button>
          </div>
        </form>
      </div>
    </div>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth()
const clockState = useClock()
const route = useRoute()
const { apiFetch } = useApi()

const showClockOut = ref(false)
const clockError = ref('')
const projects = ref<any[]>([])

const clockOutForm = reactive({
  projectId: '',
  description: '',
})

async function handleLogout() {
  await auth.logout()
  navigateTo('/login')
}

async function handleClockIn() {
  try {
    await clockState.clockIn()
  } catch (e: any) {
    // could show error
  }
}

function openClockOut() {
  clockOutForm.projectId = ''
  clockOutForm.description = ''
  clockError.value = ''
  showClockOut.value = true
  if (!projects.value.length) {
    loadProjects()
  }
}

async function loadProjects() {
  try {
    projects.value = await apiFetch<any[]>('/projects')
  } catch {
    // ignore
  }
}

async function handleClockOut() {
  clockError.value = ''
  try {
    await clockState.clockOut(clockOutForm.projectId, clockOutForm.description)
    showClockOut.value = false
  } catch (e: any) {
    clockError.value = e.message
  }
}

onMounted(() => {
  if (auth.isAuthenticated.value) {
    clockState.checkStatus()
  }
})
</script>
