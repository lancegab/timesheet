<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Member Hours</h1>
      <button @click="showForm = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        + Add Entry
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border p-4 mb-6 flex gap-4 items-end flex-wrap">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Member</label>
        <select v-model="filters.userId" class="px-3 py-1.5 border border-gray-300 rounded-md text-sm">
          <option value="">All Members</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.fullName }}</option>
        </select>
      </div>
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
      <button @click="loadEntries"
        class="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
        Filter
      </button>
    </div>

    <!-- Entries Table -->
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added By</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="entry in entries" :key="entry.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ entry.memberName }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ entry.date }}</td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="entry.entryType === 'PAID_LEAVE' ? 'bg-amber-100 text-amber-700' : entry.entryType === 'APPROVED_LEAVE' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'">
                {{ entry.entryType === 'PAID_LEAVE' ? 'Leave' : entry.entryType === 'APPROVED_LEAVE' ? 'Approved Leave' : 'Regular' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700">{{ entry.projectName || '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{{ entry.description || '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-900 text-right font-medium">{{ entry.hours }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">
              <span v-if="entry.addedByName" class="text-purple-600">{{ entry.addedByName }}</span>
              <span v-else>Self</span>
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <button @click="editEntry(entry)" class="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
              <button @click="deleteEntry(entry.id)" class="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </td>
          </tr>
          <tr v-if="entries.length === 0">
            <td colspan="8" class="px-4 py-8 text-center text-gray-400">No entries found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Entry Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">{{ editing ? 'Edit Entry' : 'Add Entry for Member' }}</h2>
        <form @submit.prevent="saveEntry" class="space-y-4">
          <div v-if="!editing">
            <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
            <select v-model="form.userId" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Select member</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.fullName }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select v-model="form.entryType" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="REGULAR">Regular</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input v-model="form.date" type="date" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div v-if="form.entryType === 'REGULAR'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select v-model="form.projectId" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Select project</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hours</label>
            <input v-model.number="form.hours" type="number" step="0.5" min="0.5" max="24" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Admin Note</label>
            <textarea v-model="form.note" rows="2" placeholder="Reason for adding this entry"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="closeForm"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

const entries = ref<any[]>([])
const users = ref<any[]>([])
const projects = ref<any[]>([])
const showForm = ref(false)
const editing = ref<string | null>(null)
const formError = ref('')

const filters = reactive({
  userId: '',
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
})

const form = reactive({
  userId: '',
  entryType: 'REGULAR',
  date: new Date().toISOString().split('T')[0],
  projectId: '',
  hours: 8,
  description: '',
  note: '',
})

async function loadEntries() {
  const params = new URLSearchParams()
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)

  entries.value = await apiFetch<any[]>(`/admin/time-entries?${params}`)
}

function editEntry(entry: any) {
  editing.value = entry.id
  form.userId = entry.userId
  form.entryType = entry.entryType
  form.date = entry.date
  form.projectId = entry.projectId || ''
  form.hours = Number(entry.hours)
  form.description = entry.description || ''
  form.note = entry.addedByNote || ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
  formError.value = ''
  form.userId = ''
  form.entryType = 'REGULAR'
  form.date = new Date().toISOString().split('T')[0]
  form.projectId = ''
  form.hours = 8
  form.description = ''
  form.note = ''
}

async function saveEntry() {
  formError.value = ''
  try {
    if (editing.value) {
      await apiFetch(`/admin/time-entries/${editing.value}`, {
        method: 'PUT',
        body: JSON.stringify({
          projectId: form.projectId || null,
          hours: form.hours,
          description: form.description || null,
          note: form.note || null,
        }),
      })
    } else {
      await apiFetch('/admin/time-entries', {
        method: 'POST',
        body: JSON.stringify(form),
      })
    }
    closeForm()
    await loadEntries()
  } catch (e: any) {
    formError.value = e.message
  }
}

async function deleteEntry(id: string) {
  if (!confirm('Delete this entry?')) return
  await apiFetch(`/admin/time-entries/${id}`, { method: 'DELETE' })
  await loadEntries()
}

onMounted(async () => {
  users.value = await apiFetch<any[]>('/users')
  projects.value = await apiFetch<any[]>('/projects')
  await loadEntries()
})
</script>
