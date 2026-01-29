<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Project Management</h1>
      <button @click="showForm = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        + Create Project
      </button>
    </div>

    <div class="grid gap-4">
      <div v-for="p in projects" :key="p.id" class="bg-white rounded-lg shadow-sm border p-4">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="font-semibold text-gray-900">{{ p.name }}</h3>
            <p class="text-sm text-gray-500">{{ p.code }} &middot; {{ p.status }}</p>
            <p v-if="p.description" class="text-sm text-gray-600 mt-1">{{ p.description }}</p>
          </div>
          <div class="flex gap-2">
            <button @click="editProject(p)" class="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
            <button @click="manageMembers(p)" class="text-purple-600 hover:text-purple-800 text-sm">Members</button>
            <button @click="adjustBudget(p)" class="text-amber-600 hover:text-amber-800 text-sm">Budget</button>
          </div>
        </div>
        <div class="flex gap-6 text-sm">
          <div>
            <span class="text-gray-500">Budget:</span>
            <span class="font-medium text-gray-900 ml-1">{{ p.hoursBudget }}h</span>
          </div>
          <div>
            <span class="text-gray-500">Logged:</span>
            <span class="font-medium text-gray-900 ml-1">{{ p.loggedHours || '0' }}h</span>
          </div>
          <div>
            <span class="text-gray-500">Remaining:</span>
            <span class="font-medium ml-1"
              :class="Number(p.hoursBudget) - Number(p.loggedHours || 0) < 0 ? 'text-red-600' : 'text-green-600'">
              {{ (Number(p.hoursBudget) - Number(p.loggedHours || 0)).toFixed(1) }}h
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Project Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">{{ editing ? 'Edit Project' : 'Create Project' }}</h2>
        <form @submit.prevent="saveProject" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input v-model="form.name" type="text" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input v-model="form.code" type="text" required :disabled="!!editing"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea v-model="form.description" rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div v-if="editing">
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select v-model="form.status" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div v-if="!editing">
            <label class="block text-sm font-medium text-gray-700 mb-1">Initial Hours Budget</label>
            <input v-model.number="form.hoursBudget" type="number" step="0.5" min="0"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
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

    <!-- Budget Adjustment Modal -->
    <div v-if="showBudget" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Budget: {{ budgetProject?.name }}</h2>
        <div class="mb-4 text-sm text-gray-600">Current budget: <span class="font-bold text-gray-900">{{ budgetProject?.hoursBudget }}h</span></div>

        <!-- History -->
        <div v-if="budgetHistory.length" class="mb-4 max-h-48 overflow-y-auto">
          <table class="min-w-full text-xs">
            <thead>
              <tr class="text-gray-500 uppercase">
                <th class="pb-1 text-left">Date</th>
                <th class="pb-1 text-left">By</th>
                <th class="pb-1 text-right">Amount</th>
                <th class="pb-1 text-right">New Total</th>
                <th class="pb-1 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in budgetHistory" :key="h.id" class="border-t border-gray-100">
                <td class="py-1 text-gray-600">{{ new Date(h.createdAt).toLocaleDateString() }}</td>
                <td class="py-1 text-gray-600">{{ h.adjustedByName }}</td>
                <td class="py-1 text-right" :class="Number(h.adjustmentAmount) >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ Number(h.adjustmentAmount) >= 0 ? '+' : '' }}{{ h.adjustmentAmount }}
                </td>
                <td class="py-1 text-right font-medium">{{ h.newBudget }}h</td>
                <td class="py-1 text-gray-600 max-w-[200px] truncate">{{ h.reason }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <form @submit.prevent="saveBudgetAdjustment" class="space-y-3 border-t pt-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Adjustment Amount (+ or -)</label>
            <input v-model.number="budgetForm.amount" type="number" step="0.5" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
            <textarea v-model="budgetForm.reason" rows="2" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"></textarea>
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showBudget = false; formError = ''"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Close</button>
            <button type="submit"
              class="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium">Adjust</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Members Modal -->
    <div v-if="showMembers" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Members: {{ membersProject?.name }}</h2>

        <div class="mb-4 space-y-2">
          <div v-for="m in projectMembers" :key="m.userId" class="flex justify-between items-center text-sm border-b pb-2">
            <span class="text-gray-900">{{ m.fullName }} <span class="text-gray-400">({{ m.email }})</span></span>
            <button @click="removeMember(m.userId)" class="text-red-600 hover:text-red-800 text-xs">Remove</button>
          </div>
          <div v-if="!projectMembers.length" class="text-sm text-gray-400">No members assigned</div>
        </div>

        <div class="border-t pt-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Add Members</label>
          <div class="flex gap-2">
            <select v-model="newMemberId" class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Select user</option>
              <option v-for="u in availableUsers" :key="u.id" :value="u.id">{{ u.fullName }}</option>
            </select>
            <button @click="addMember" :disabled="!newMemberId"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50">Add</button>
          </div>
        </div>

        <div class="flex justify-end mt-4">
          <button @click="showMembers = false"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

const projects = ref<any[]>([])
const showForm = ref(false)
const editing = ref<string | null>(null)
const formError = ref('')

const form = reactive({ name: '', code: '', description: '', status: 'ACTIVE', hoursBudget: 0 })

const showBudget = ref(false)
const budgetProject = ref<any>(null)
const budgetHistory = ref<any[]>([])
const budgetForm = reactive({ amount: 0, reason: '' })

const showMembers = ref(false)
const membersProject = ref<any>(null)
const projectMembers = ref<any[]>([])
const allUsers = ref<any[]>([])
const newMemberId = ref('')

const availableUsers = computed(() => {
  const assigned = new Set(projectMembers.value.map(m => m.userId))
  return allUsers.value.filter(u => !assigned.has(u.id))
})

async function loadProjects() {
  const all = await apiFetch<any[]>('/projects')
  // Load logged hours for each project
  projects.value = await Promise.all(all.map(async p => {
    try {
      const detail = await apiFetch<any>(`/projects/${p.id}`)
      return { ...p, loggedHours: detail.loggedHours }
    } catch {
      return { ...p, loggedHours: '0' }
    }
  }))
}

function editProject(p: any) {
  editing.value = p.id
  form.name = p.name
  form.code = p.code
  form.description = p.description || ''
  form.status = p.status
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
  formError.value = ''
  form.name = ''
  form.code = ''
  form.description = ''
  form.status = 'ACTIVE'
  form.hoursBudget = 0
}

async function saveProject() {
  formError.value = ''
  try {
    if (editing.value) {
      await apiFetch(`/projects/${editing.value}`, {
        method: 'PUT',
        body: JSON.stringify({ name: form.name, description: form.description, status: form.status }),
      })
    } else {
      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify(form),
      })
    }
    closeForm()
    await loadProjects()
  } catch (e: any) {
    formError.value = e.message
  }
}

async function adjustBudget(p: any) {
  budgetProject.value = p
  budgetForm.amount = 0
  budgetForm.reason = ''
  formError.value = ''
  budgetHistory.value = await apiFetch<any[]>(`/projects/${p.id}/budget-history`)
  showBudget.value = true
}

async function saveBudgetAdjustment() {
  formError.value = ''
  try {
    await apiFetch(`/projects/${budgetProject.value.id}/budget-adjustment`, {
      method: 'POST',
      body: JSON.stringify({ amount: budgetForm.amount, reason: budgetForm.reason }),
    })
    budgetHistory.value = await apiFetch<any[]>(`/projects/${budgetProject.value.id}/budget-history`)
    budgetForm.amount = 0
    budgetForm.reason = ''
    await loadProjects()
  } catch (e: any) {
    formError.value = e.message
  }
}

async function manageMembers(p: any) {
  membersProject.value = p
  newMemberId.value = ''
  projectMembers.value = await apiFetch<any[]>(`/projects/${p.id}/members`)
  if (!allUsers.value.length) {
    allUsers.value = await apiFetch<any[]>('/users')
  }
  showMembers.value = true
}

async function addMember() {
  if (!newMemberId.value) return
  await apiFetch(`/projects/${membersProject.value.id}/members`, {
    method: 'POST',
    body: JSON.stringify({ userIds: [newMemberId.value] }),
  })
  newMemberId.value = ''
  projectMembers.value = await apiFetch<any[]>(`/projects/${membersProject.value.id}/members`)
}

async function removeMember(userId: string) {
  await apiFetch(`/projects/${membersProject.value.id}/members/${userId}`, { method: 'DELETE' })
  projectMembers.value = await apiFetch<any[]>(`/projects/${membersProject.value.id}/members`)
}

onMounted(loadProjects)
</script>
