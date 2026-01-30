<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">My Leave Requests</h1>
      <button @click="showForm = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        + Request Leave
      </button>
    </div>

    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Review Note</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="r in requests" :key="r.id">
            <td class="px-4 py-3 text-sm text-gray-900">{{ r.date }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ r.hours }}h</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{{ r.reason || '-' }}</td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'">
                {{ r.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ r.reviewNote || '-' }}</td>
            <td class="px-4 py-3 text-right">
              <button v-if="r.status === 'PENDING'" @click="cancelRequest(r.id)"
                class="text-red-600 hover:text-red-800 text-sm">Cancel</button>
            </td>
          </tr>
          <tr v-if="requests.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">No leave requests</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Request Leave Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Request Leave</h2>
        <form @submit.prevent="submitRequest" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input v-model="form.date" type="date" required :min="minDate"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            <p class="text-xs text-gray-500 mt-1">Must be at least 14 days from today</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hours</label>
            <input v-model.number="form.hours" type="number" step="0.5" min="0.5" max="24"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea v-model="form.reason" rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showForm = false; formError = ''"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">Submit</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

const requests = ref<any[]>([])
const showForm = ref(false)
const formError = ref('')

const minDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().split('T')[0]
})

const form = reactive({
  date: '',
  hours: 8,
  reason: '',
})

async function loadRequests() {
  requests.value = await apiFetch<any[]>('/leave-requests')
}

async function submitRequest() {
  formError.value = ''
  try {
    await apiFetch('/leave-requests', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    showForm.value = false
    form.date = ''
    form.hours = 8
    form.reason = ''
    await loadRequests()
  } catch (e: any) {
    formError.value = e.message
  }
}

async function cancelRequest(id: string) {
  if (!confirm('Cancel this leave request?')) return
  await apiFetch(`/leave-requests/${id}`, { method: 'DELETE' })
  await loadRequests()
}

onMounted(loadRequests)
</script>
