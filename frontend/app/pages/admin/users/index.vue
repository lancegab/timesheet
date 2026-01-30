<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">User Management</h1>
      <button @click="showForm = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        + Create User
      </button>
    </div>

    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="u in users" :key="u.id">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ u.fullName }}</td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ u.email }}</td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
                {{ u.role }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {{ u.employmentType === 'FULL_TIME' ? 'Full-time' : u.employmentType === 'PART_TIME' ? 'Part-time' : 'Contract' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : u.status === 'LOCKED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'">
                {{ u.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never' }}</td>
            <td class="px-4 py-3 text-right space-x-2">
              <button @click="editUser(u)" class="text-indigo-600 hover:text-indigo-800 text-sm">Edit</button>
              <button @click="toggleStatus(u)" class="text-sm"
                :class="u.status === 'ACTIVE' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'">
                {{ u.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
              </button>
              <button @click="resetPassword(u)" class="text-amber-600 hover:text-amber-800 text-sm">Reset PW</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit User Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">{{ editing ? 'Edit User' : 'Create User' }}</h2>
        <form @submit.prevent="saveUser" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input v-model="form.email" type="email" :required="!editing" :disabled="!!editing"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input v-model="form.fullName" type="text" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select v-model="form.role" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
            <select v-model="form.employmentType" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>
          <div v-if="!editing">
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input v-model="form.password" type="password" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="closeForm"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <div v-if="showResetPw" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Reset Password for {{ resetTarget?.fullName }}</h2>
        <form @submit.prevent="doResetPassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input v-model="resetNewPw" type="password" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div v-if="formError" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ formError }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" @click="showResetPw = false; formError = ''"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium">Reset</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

const users = ref<any[]>([])
const showForm = ref(false)
const editing = ref<string | null>(null)
const formError = ref('')
const showResetPw = ref(false)
const resetTarget = ref<any>(null)
const resetNewPw = ref('')

const form = reactive({ email: '', fullName: '', role: 'MEMBER', employmentType: 'FULL_TIME', password: '' })

async function loadUsers() {
  users.value = await apiFetch<any[]>('/users')
}

function editUser(u: any) {
  editing.value = u.id
  form.email = u.email
  form.fullName = u.fullName
  form.role = u.role
  form.employmentType = u.employmentType || 'FULL_TIME'
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
  formError.value = ''
  form.email = ''
  form.fullName = ''
  form.role = 'MEMBER'
  form.employmentType = 'FULL_TIME'
  form.password = ''
}

async function saveUser() {
  formError.value = ''
  try {
    if (editing.value) {
      await apiFetch(`/users/${editing.value}`, {
        method: 'PUT',
        body: JSON.stringify({ fullName: form.fullName, role: form.role, employmentType: form.employmentType }),
      })
    } else {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(form),
      })
    }
    closeForm()
    await loadUsers()
  } catch (e: any) {
    formError.value = e.message
  }
}

async function toggleStatus(u: any) {
  const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  await apiFetch(`/users/${u.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus }),
  })
  await loadUsers()
}

function resetPassword(u: any) {
  resetTarget.value = u
  resetNewPw.value = ''
  formError.value = ''
  showResetPw.value = true
}

async function doResetPassword() {
  formError.value = ''
  try {
    await apiFetch(`/users/${resetTarget.value.id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword: resetNewPw.value }),
    })
    showResetPw.value = false
  } catch (e: any) {
    formError.value = e.message
  }
}

onMounted(loadUsers)
</script>
