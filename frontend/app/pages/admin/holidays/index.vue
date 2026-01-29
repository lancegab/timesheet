<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Paid Holiday Management</h1>
      <button @click="showForm = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        + Create Holiday
      </button>
    </div>

    <div class="grid gap-4">
      <div v-for="h in holidays" :key="h.id" class="bg-white rounded-lg shadow-sm border p-4">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-semibold text-gray-900">{{ h.name }}</h3>
            <p class="text-sm text-gray-500">{{ h.date }} &middot; {{ h.hours }}h</p>
            <p v-if="h.description" class="text-sm text-gray-600 mt-1">{{ h.description }}</p>
          </div>
          <div class="flex gap-2">
            <button @click="editHoliday(h)" class="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button @click="manageAssignments(h)" class="text-purple-600 hover:text-purple-800 text-sm">Assign</button>
            <button @click="deleteHoliday(h.id)" class="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        </div>
      </div>
      <div v-if="!holidays.length" class="text-center text-gray-400 py-8">No holidays defined</div>
    </div>

    <!-- Create/Edit Holiday Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">{{ editing ? 'Edit Holiday' : 'Create Holiday' }}</h2>
        <form @submit.prevent="saveHoliday" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Holiday Name</label>
            <input v-model="form.name" type="text" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input v-model="form.date" type="date" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hours</label>
            <input v-model.number="form.hours" type="number" step="0.5" min="0.5" max="24"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="2"
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

    <!-- Assignments Modal -->
    <div v-if="showAssign" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Assignments: {{ assignHoliday?.name }}</h2>

        <div class="mb-4 space-y-2">
          <div v-for="a in assignments" :key="a.userId" class="flex justify-between items-center text-sm border-b pb-2">
            <span class="text-gray-900">{{ a.fullName }}</span>
            <button @click="unassign(a.userId)" class="text-red-600 hover:text-red-800 text-xs">Remove</button>
          </div>
          <div v-if="!assignments.length" class="text-sm text-gray-400">No members assigned</div>
        </div>

        <div class="border-t pt-4 space-y-3">
          <button @click="assignAll"
            class="w-full py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium">
            Assign to All Active Members
          </button>
          <div class="flex gap-2">
            <select v-model="newAssignId" class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Select user</option>
              <option v-for="u in availableUsers" :key="u.id" :value="u.id">{{ u.fullName }}</option>
            </select>
            <button @click="assignOne" :disabled="!newAssignId"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50">Add</button>
          </div>
        </div>

        <div class="flex justify-end mt-4">
          <button @click="showAssign = false"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

const holidays = ref<any[]>([])
const showForm = ref(false)
const editing = ref<string | null>(null)
const formError = ref('')
const form = reactive({ name: '', date: '', hours: 8, description: '' })

const showAssign = ref(false)
const assignHoliday = ref<any>(null)
const assignments = ref<any[]>([])
const allUsers = ref<any[]>([])
const newAssignId = ref('')

const availableUsers = computed(() => {
  const assigned = new Set(assignments.value.map(a => a.userId))
  return allUsers.value.filter(u => !assigned.has(u.id))
})

async function loadHolidays() {
  holidays.value = await apiFetch<any[]>('/holidays')
}

function editHoliday(h: any) {
  editing.value = h.id
  form.name = h.name
  form.date = h.date
  form.hours = Number(h.hours)
  form.description = h.description || ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
  formError.value = ''
  form.name = ''
  form.date = ''
  form.hours = 8
  form.description = ''
}

async function saveHoliday() {
  formError.value = ''
  try {
    if (editing.value) {
      await apiFetch(`/holidays/${editing.value}`, { method: 'PUT', body: JSON.stringify(form) })
    } else {
      await apiFetch('/holidays', { method: 'POST', body: JSON.stringify(form) })
    }
    closeForm()
    await loadHolidays()
  } catch (e: any) {
    formError.value = e.message
  }
}

async function deleteHoliday(id: string) {
  if (!confirm('Delete this holiday and all assignments?')) return
  await apiFetch(`/holidays/${id}`, { method: 'DELETE' })
  await loadHolidays()
}

async function manageAssignments(h: any) {
  assignHoliday.value = h
  newAssignId.value = ''
  assignments.value = await apiFetch<any[]>(`/holidays/${h.id}/assignments`)
  if (!allUsers.value.length) {
    allUsers.value = await apiFetch<any[]>('/users')
  }
  showAssign.value = true
}

async function assignAll() {
  await apiFetch(`/holidays/${assignHoliday.value.id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ allActive: true }),
  })
  assignments.value = await apiFetch<any[]>(`/holidays/${assignHoliday.value.id}/assignments`)
}

async function assignOne() {
  if (!newAssignId.value) return
  await apiFetch(`/holidays/${assignHoliday.value.id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ userIds: [newAssignId.value] }),
  })
  newAssignId.value = ''
  assignments.value = await apiFetch<any[]>(`/holidays/${assignHoliday.value.id}/assignments`)
}

async function unassign(userId: string) {
  await apiFetch(`/holidays/${assignHoliday.value.id}/assign/${userId}`, { method: 'DELETE' })
  assignments.value = await apiFetch<any[]>(`/holidays/${assignHoliday.value.id}/assignments`)
}

onMounted(loadHolidays)
</script>
