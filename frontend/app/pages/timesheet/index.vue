<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">My Timesheet</h1>
      <button @click="showEntryForm = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        + New Entry
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border p-4 mb-6 flex gap-4 items-end flex-wrap">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
        <input v-model="filters.startDate" type="date"
          class="px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">End Date</label>
        <input v-model="filters.endDate" type="date"
          class="px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Project</label>
        <select v-model="filters.projectId"
          class="px-3 py-1.5 border border-gray-300 rounded-md text-sm">
          <option value="">All Projects</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <button @click="loadEntries"
        class="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
        Filter
      </button>
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="text-xs text-gray-500 uppercase">Total Hours</div>
        <div class="text-2xl font-bold text-gray-900">{{ totalHours }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="text-xs text-gray-500 uppercase">Regular</div>
        <div class="text-2xl font-bold text-indigo-600">{{ regularHours }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="text-xs text-gray-500 uppercase">Paid Leave</div>
        <div class="text-2xl font-bold text-amber-600">{{ leaveHours }}</div>
      </div>
    </div>

    <!-- Holidays -->
    <div v-if="holidays.length > 0" class="mb-6">
      <h2 class="text-sm font-semibold text-gray-700 mb-2">Upcoming Paid Holidays</h2>
      <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
        <div v-for="h in holidays" :key="h.id" class="flex justify-between text-sm">
          <span class="text-emerald-800 font-medium">{{ h.name }}</span>
          <span class="text-emerald-600">{{ h.date }} &middot; {{ h.hours }}h</span>
        </div>
      </div>
    </div>

    <!-- Entries Table -->
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="entry in entries" :key="entry.id" :class="!entry.editable ? 'bg-gray-50' : ''">
            <td class="px-4 py-3 text-sm text-gray-900">{{ entry.date }}</td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="entry.entryType === 'PAID_LEAVE' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'">
                {{ entry.entryType === 'PAID_LEAVE' ? 'Leave' : 'Regular' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700">{{ entry.projectName || '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{{ entry.description || '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900 text-right font-medium">{{ entry.hours }}</td>
            <td class="px-4 py-3 text-right">
              <template v-if="entry.editable">
                <button @click="editEntry(entry)" class="text-indigo-600 hover:text-indigo-800 text-sm mr-2">Edit</button>
                <button @click="deleteEntry(entry.id)" class="text-red-600 hover:text-red-800 text-sm">Delete</button>
              </template>
              <span v-else class="text-xs text-gray-400">Frozen</span>
            </td>
          </tr>
          <tr v-if="entries.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">No time entries found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Entry Modal -->
    <div v-if="showEntryForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">{{ editingEntry ? 'Edit Entry' : 'New Time Entry' }}</h2>
        <form @submit.prevent="saveEntry" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select v-model="entryForm.entryType"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="REGULAR">Regular</option>
              <option value="PAID_LEAVE">Paid Leave</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input v-model="entryForm.date" type="date" required
              :min="dateRange?.minDate" :max="dateRange?.maxDate"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div v-if="entryForm.entryType === 'REGULAR'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select v-model="entryForm.projectId" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Select project</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hours</label>
            <input v-model.number="entryForm.hours" type="number" step="0.5" min="0.5" max="24" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="entryForm.description" rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="closeForm"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit" :disabled="saving"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

interface TimeEntry {
  id: string
  userId: string
  projectId: string | null
  projectName: string | null
  entryType: string
  date: string
  hours: string
  description: string | null
  editable: boolean
}

const entries = ref<TimeEntry[]>([])
const projects = ref<any[]>([])
const holidays = ref<any[]>([])
const dateRange = ref<{ minDate: string; maxDate: string } | null>(null)
const showEntryForm = ref(false)
const editingEntry = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)

const filters = reactive({
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  projectId: '',
})

const entryForm = reactive({
  entryType: 'REGULAR',
  date: new Date().toISOString().split('T')[0],
  projectId: '',
  hours: 8,
  description: '',
})

const totalHours = computed(() => {
  return entries.value.reduce((sum, e) => sum + Number(e.hours), 0).toFixed(1)
})

const regularHours = computed(() => {
  return entries.value.filter(e => e.entryType === 'REGULAR').reduce((sum, e) => sum + Number(e.hours), 0).toFixed(1)
})

const leaveHours = computed(() => {
  return entries.value.filter(e => e.entryType === 'PAID_LEAVE').reduce((sum, e) => sum + Number(e.hours), 0).toFixed(1)
})

async function loadEntries() {
  const params = new URLSearchParams()
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.projectId) params.set('projectId', filters.projectId)

  const data = await apiFetch<any>(`/time-entries?${params}`)
  entries.value = data.entries
  dateRange.value = data.allowedDateRange
}

async function loadProjects() {
  projects.value = await apiFetch<any[]>('/projects')
}

async function loadHolidays() {
  holidays.value = await apiFetch<any[]>('/holidays')
}

function editEntry(entry: TimeEntry) {
  editingEntry.value = entry.id
  entryForm.entryType = entry.entryType
  entryForm.date = entry.date
  entryForm.projectId = entry.projectId || ''
  entryForm.hours = Number(entry.hours)
  entryForm.description = entry.description || ''
  showEntryForm.value = true
}

function closeForm() {
  showEntryForm.value = false
  editingEntry.value = null
  formError.value = ''
  entryForm.entryType = 'REGULAR'
  entryForm.date = new Date().toISOString().split('T')[0]
  entryForm.projectId = ''
  entryForm.hours = 8
  entryForm.description = ''
}

async function saveEntry() {
  formError.value = ''
  saving.value = true
  try {
    const body: any = {
      entryType: entryForm.entryType,
      date: entryForm.date,
      hours: entryForm.hours,
      description: entryForm.description || null,
    }
    if (entryForm.entryType === 'REGULAR') {
      body.projectId = entryForm.projectId
    }

    if (editingEntry.value) {
      await apiFetch(`/time-entries/${editingEntry.value}`, { method: 'PUT', body: JSON.stringify(body) })
    } else {
      await apiFetch('/time-entries', { method: 'POST', body: JSON.stringify(body) })
    }
    closeForm()
    await loadEntries()
  } catch (e: any) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function deleteEntry(id: string) {
  if (!confirm('Delete this entry?')) return
  await apiFetch(`/time-entries/${id}`, { method: 'DELETE' })
  await loadEntries()
}

onMounted(() => {
  loadEntries()
  loadProjects()
  loadHolidays()
})
</script>
