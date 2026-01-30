<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Leave Requests</h1>
      <button @click="showAdminForm = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        + Add Leave for Member
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border p-4 mb-6 flex gap-4 items-end flex-wrap">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Status</label>
        <select v-model="statusFilter" @change="loadRequests"
          class="px-3 py-1.5 border border-gray-300 rounded-md text-sm">
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="r in requests" :key="r.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ r.memberName }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ r.date }}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{{ r.hours }}h</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{{ r.reason || '-' }}</td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'">
                {{ r.status }}
              </span>
              <span v-if="r.addedBy" class="ml-1 text-xs text-purple-600">(admin-added)</span>
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <template v-if="r.status === 'PENDING'">
                <button @click="approveRequest(r.id)" class="text-green-600 hover:text-green-800 text-sm">Approve</button>
                <button @click="openReject(r)" class="text-red-600 hover:text-red-800 text-sm">Reject</button>
              </template>
              <span v-else class="text-xs text-gray-400">Reviewed</span>
            </td>
          </tr>
          <tr v-if="requests.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">No leave requests</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Reject Modal -->
    <div v-if="showReject" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Reject Leave Request</h2>
        <form @submit.prevent="rejectRequest" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rejection Note (required)</label>
            <textarea v-model="rejectNote" rows="3" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showReject = false; formError = ''"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium">Reject</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Admin Add Leave Modal -->
    <div v-if="showAdminForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Add Leave for Member</h2>
        <form @submit.prevent="adminAddLeave" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
            <select v-model="adminForm.userId" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Select member</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.fullName }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input v-model="adminForm.date" type="date" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hours</label>
            <input v-model.number="adminForm.hours" type="number" step="0.5" min="0.5" max="24"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea v-model="adminForm.reason" rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showAdminForm = false; formError = ''"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">Add Leave</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

const requests = ref<any[]>([])
const users = ref<any[]>([])
const statusFilter = ref('')
const showReject = ref(false)
const rejectTarget = ref<any>(null)
const rejectNote = ref('')
const showAdminForm = ref(false)
const formError = ref('')

const adminForm = reactive({
  userId: '',
  date: '',
  hours: 8,
  reason: '',
})

async function loadRequests() {
  const params = new URLSearchParams()
  if (statusFilter.value) params.set('status', statusFilter.value)
  requests.value = await apiFetch<any[]>(`/leave-requests?${params}`)
}

async function approveRequest(id: string) {
  await apiFetch(`/leave-requests/${id}/approve`, { method: 'PUT' })
  await loadRequests()
}

function openReject(r: any) {
  rejectTarget.value = r
  rejectNote.value = ''
  formError.value = ''
  showReject.value = true
}

async function rejectRequest() {
  formError.value = ''
  try {
    await apiFetch(`/leave-requests/${rejectTarget.value.id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ note: rejectNote.value }),
    })
    showReject.value = false
    await loadRequests()
  } catch (e: any) {
    formError.value = e.message
  }
}

async function adminAddLeave() {
  formError.value = ''
  try {
    await apiFetch('/leave-requests/admin', {
      method: 'POST',
      body: JSON.stringify(adminForm),
    })
    showAdminForm.value = false
    adminForm.userId = ''
    adminForm.date = ''
    adminForm.hours = 8
    adminForm.reason = ''
    await loadRequests()
  } catch (e: any) {
    formError.value = e.message
  }
}

onMounted(async () => {
  users.value = await apiFetch<any[]>('/users')
  await loadRequests()
})
</script>
