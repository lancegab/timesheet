<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Main Nav -->
    <nav v-if="auth.isAuthenticated.value" class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-14">
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
            <span class="text-sm text-gray-500">{{ auth.user.value?.fullName }}</span>
            <span class="text-xs px-2 py-0.5 rounded-full"
              :class="auth.isAdmin.value ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
              {{ auth.user.value?.role }}
            </span>
            <button @click="handleLogout" class="text-sm text-red-600 hover:text-red-800">Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Clock Bar -->
    <div v-if="auth.isAuthenticated.value" class="bg-gray-900 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-12">
          <!-- Not clocked in -->
          <template v-if="!clockState.active.value">
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-400">Not clocked in</span>
              <select v-model="clockInProject" class="bg-gray-800 text-white text-sm rounded-md border border-gray-700 px-3 py-1 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">Select project</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <select v-model="clockInWorkType" class="bg-gray-800 text-white text-sm rounded-md border border-gray-700 px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="DEVELOPMENT">Dev</option>
                <option value="QA">QA</option>
                <option value="MANAGEMENT">Mgmt</option>
              </select>
              <button @click="handleClockIn" :disabled="!clockInProject"
                class="px-4 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition">
                Clock In
              </button>
            </div>
          </template>

          <!-- Clocked in -->
          <template v-else>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <span class="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span class="text-sm font-mono font-bold text-emerald-400">{{ clockState.formatElapsed(clockState.elapsed.value) }}</span>
              </div>
              <div class="h-5 w-px bg-gray-700"></div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">Project:</span>
                <span class="text-sm font-medium">{{ clockState.session.value?.projectName || 'Loading...' }}</span>
                <span class="text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="clockState.session.value?.workType === 'QA' ? 'bg-cyan-800 text-cyan-200' : clockState.session.value?.workType === 'MANAGEMENT' ? 'bg-purple-800 text-purple-200' : 'bg-blue-800 text-blue-200'">
                  {{ workTypeLabel(clockState.session.value?.workType) }}
                </span>
                <span class="text-xs text-gray-500 font-mono">({{ clockState.formatElapsed(clockState.segmentElapsed.value) }})</span>
              </div>
              <div class="h-5 w-px bg-gray-700"></div>
              <div class="flex items-center gap-2">
                <select v-model="switchProjectId" class="bg-gray-800 text-white text-sm rounded-md border border-gray-700 px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">Switch project...</option>
                  <option v-for="p in projects.filter(p => p.id !== clockState.session.value?.projectId)" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <select v-model="switchWorkType" class="bg-gray-800 text-white text-sm rounded-md border border-gray-700 px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="DEVELOPMENT">Dev</option>
                  <option value="QA">QA</option>
                  <option value="MANAGEMENT">Mgmt</option>
                </select>
                <button v-if="switchProjectId || switchWorkType !== (clockState.session.value?.workType || 'DEVELOPMENT')" @click="openSwitchModal"
                  class="px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium transition">
                  Switch
                </button>
              </div>
              <button @click="openClockOut"
                class="px-4 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition">
                Clock Out
              </button>
            </div>
          </template>

          <div class="text-xs text-gray-500">
            <span v-if="clockState.active.value">Since {{ formatTime(clockState.session.value?.clockInAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Auto-closed session banner -->
    <div v-if="clockState.autoClosedSession.value" class="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div class="max-w-7xl mx-auto flex justify-between items-center">
        <p class="text-sm text-amber-800">
          Your clock session was auto-closed after 8 hours. Please update the time entry with the correct description.
        </p>
        <button @click="clockState.dismissAutoClosed()" class="text-amber-600 hover:text-amber-800 text-sm font-medium">Dismiss</button>
      </div>
    </div>

    <!-- Switch Project Modal -->
    <div v-if="showSwitchModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-1">Switch Project</h2>
        <p class="text-sm text-gray-500 mb-4">Describe what you worked on for <strong>{{ clockState.session.value?.projectName }}</strong></p>
        <form @submit.prevent="handleSwitch" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="switchDescription" rows="3" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="What did you work on?"></textarea>
          </div>
          <div v-if="clockError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ clockError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showSwitchModal = false; clockError = ''"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium">Switch</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Clock Out Modal -->
    <div v-if="showClockOut" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-1">Clock Out</h2>
        <p class="text-sm text-gray-500 mb-4">Describe what you worked on for <strong>{{ clockState.session.value?.projectName }}</strong></p>
        <form @submit.prevent="handleClockOut" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="clockOutDescription" rows="3" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="What did you work on?"></textarea>
          </div>
          <div v-if="clockError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ clockError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showClockOut = false; clockError = ''"
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

const projects = ref<any[]>([])
const clockInProject = ref('')
const clockInWorkType = ref('DEVELOPMENT')
const switchProjectId = ref('')
const switchWorkType = ref('DEVELOPMENT')
const switchDescription = ref('')
const clockOutDescription = ref('')
const showSwitchModal = ref(false)
const showClockOut = ref(false)
const clockError = ref('')

function formatTime(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function workTypeLabel(wt?: string) {
  if (wt === 'QA') return 'QA'
  if (wt === 'MANAGEMENT') return 'Mgmt'
  return 'Dev'
}

async function handleLogout() {
  await auth.logout()
  navigateTo('/login')
}

async function loadProjects() {
  try {
    projects.value = await apiFetch<any[]>('/projects')
  } catch { /* ignore */ }
}

async function handleClockIn() {
  if (!clockInProject.value) return
  clockError.value = ''
  try {
    await clockState.clockIn(clockInProject.value, clockInWorkType.value)
    // Refresh to get project name
    await clockState.checkStatus()
    clockInProject.value = ''
    clockInWorkType.value = 'DEVELOPMENT'
  } catch (e: any) {
    clockError.value = e.message
  }
}

function openSwitchModal() {
  // If no new project selected, keep current project (just switching work type)
  if (!switchProjectId.value) {
    switchProjectId.value = clockState.session.value?.projectId || ''
  }
  switchDescription.value = ''
  clockError.value = ''
  showSwitchModal.value = true
}

async function handleSwitch() {
  clockError.value = ''
  try {
    await clockState.switchProject(switchProjectId.value, switchDescription.value, switchWorkType.value)
    showSwitchModal.value = false
    switchProjectId.value = ''
    switchWorkType.value = clockState.session.value?.workType || 'DEVELOPMENT'
  } catch (e: any) {
    clockError.value = e.message
  }
}

function openClockOut() {
  clockOutDescription.value = ''
  clockError.value = ''
  showClockOut.value = true
}

async function handleClockOut() {
  clockError.value = ''
  try {
    await clockState.clockOut(clockOutDescription.value)
    showClockOut.value = false
  } catch (e: any) {
    clockError.value = e.message
  }
}

watch(() => clockState.session.value?.workType, (wt) => {
  if (wt) switchWorkType.value = wt
})

onMounted(async () => {
  if (auth.isAuthenticated.value) {
    await loadProjects()
    await clockState.checkStatus()
    if (clockState.session.value?.workType) {
      switchWorkType.value = clockState.session.value.workType
    }
  }
})
</script>
