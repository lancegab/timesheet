<template>
  <div class="max-w-md mx-auto mt-10">
    <div class="bg-white rounded-lg shadow-md p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Change Password</h1>
      <p v-if="auth.user.value?.mustChangePassword" class="text-sm text-amber-600 mb-6">
        You must change your password before continuing.
      </p>
      <form @submit.prevent="handleChange" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
          <input v-model="form.currentPassword" type="password" required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input v-model="form.newPassword" type="password" required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <ul class="text-xs text-gray-500 mt-1 space-y-0.5">
            <li :class="form.newPassword.length >= 8 ? 'text-green-600' : ''">At least 8 characters</li>
            <li :class="/[A-Z]/.test(form.newPassword) ? 'text-green-600' : ''">One uppercase letter</li>
            <li :class="/[a-z]/.test(form.newPassword) ? 'text-green-600' : ''">One lowercase letter</li>
            <li :class="/[0-9]/.test(form.newPassword) ? 'text-green-600' : ''">One number</li>
            <li :class="/[^A-Za-z0-9]/.test(form.newPassword) ? 'text-green-600' : ''">One special character</li>
          </ul>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
          <input v-model="form.confirmPassword" type="password" required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div v-if="error" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">{{ error }}</div>
        <div v-if="success" class="text-green-600 text-sm bg-green-50 p-3 rounded-md">{{ success }}</div>
        <button type="submit" :disabled="loading"
          class="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium">
          {{ loading ? 'Updating...' : 'Update Password' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const auth = useAuth()
const { apiFetch } = useApi()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const error = ref('')
const success = ref('')
const loading = ref(false)

async function handleChange() {
  error.value = ''
  success.value = ''

  if (form.newPassword !== form.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true
  try {
    await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    })
    success.value = 'Password changed successfully'
    if (auth.user.value) {
      auth.user.value.mustChangePassword = false
      localStorage.setItem('auth_user', JSON.stringify(auth.user.value))
    }
    setTimeout(() => navigateTo(auth.isAdmin.value ? '/admin' : '/timesheet'), 1500)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
