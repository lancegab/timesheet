<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

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
          <option v-for="p in allProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Member</label>
        <select v-model="filters.userId"
          class="px-3 py-1.5 border border-gray-300 rounded-md text-sm">
          <option value="">All Members</option>
          <option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.fullName }}</option>
        </select>
      </div>
      <button @click="loadReport"
        class="px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        Apply
      </button>
      <button @click="exportCSV"
        class="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
        Export CSV
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="text-xs text-gray-500 uppercase">Total Hours</div>
        <div class="text-2xl font-bold text-gray-900">{{ report?.totalHours || '0' }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="text-xs text-gray-500 uppercase">Holiday Hours</div>
        <div class="text-2xl font-bold text-emerald-600">{{ report?.paidHolidayHours || '0' }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="text-xs text-gray-500 uppercase">Projects</div>
        <div class="text-2xl font-bold text-indigo-600">{{ report?.byProject?.length || 0 }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="text-xs text-gray-500 uppercase">Members</div>
        <div class="text-2xl font-bold text-purple-600">{{ report?.byMember?.length || 0 }}</div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-6 mb-6">
      <!-- By Project -->
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Hours by Project</h2>
        <div class="space-y-2">
          <div v-for="p in report?.byProject" :key="p.projectId" class="flex justify-between text-sm">
            <span class="text-gray-700">{{ p.projectName || 'Unassigned' }}</span>
            <span class="font-medium text-gray-900">{{ p.totalHours }}h</span>
          </div>
        </div>
      </div>

      <!-- By Member -->
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Hours by Member</h2>
        <div class="space-y-2">
          <div v-for="m in report?.byMember" :key="m.userId" class="flex justify-between text-sm">
            <span class="text-gray-700">{{ m.fullName }}</span>
            <span class="font-medium text-gray-900">{{ m.totalHours }}h</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Budget Utilization -->
    <div class="bg-white rounded-lg shadow-sm border p-4 mb-6">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Project Budget Utilization</h2>
      <table class="min-w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-gray-500 uppercase">
            <th class="pb-2">Project</th>
            <th class="pb-2 text-right">Budget</th>
            <th class="pb-2 text-right">Logged</th>
            <th class="pb-2 text-right">Remaining</th>
            <th class="pb-2 text-right">Used %</th>
            <th class="pb-2 w-48"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="b in report?.projectBudgets" :key="b.id">
            <td class="py-2 text-gray-900">{{ b.name }}</td>
            <td class="py-2 text-right text-gray-700">{{ b.hoursBudget }}h</td>
            <td class="py-2 text-right text-gray-700">{{ b.loggedHours }}h</td>
            <td class="py-2 text-right" :class="Number(b.remainingHours) < 0 ? 'text-red-600 font-medium' : 'text-gray-700'">
              {{ b.remainingHours }}h
            </td>
            <td class="py-2 text-right text-gray-700">{{ b.percentUsed }}%</td>
            <td class="py-2">
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="h-2 rounded-full"
                  :class="Number(b.percentUsed) > 100 ? 'bg-red-500' : Number(b.percentUsed) > 80 ? 'bg-amber-500' : 'bg-indigo-500'"
                  :style="{ width: Math.min(Number(b.percentUsed), 100) + '%' }"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detailed Entries -->
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div class="px-4 py-3 border-b bg-gray-50">
        <h2 class="text-sm font-semibold text-gray-700">Detailed Entries</h2>
      </div>
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="e in detailedEntries" :key="e.id">
            <td class="px-4 py-2 text-sm text-gray-900">{{ e.date }}</td>
            <td class="px-4 py-2 text-sm text-gray-700">{{ e.memberName }}</td>
            <td class="px-4 py-2 text-sm text-gray-700">{{ e.projectName || '-' }}</td>
            <td class="px-4 py-2 text-sm">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="e.entryType === 'PAID_LEAVE' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'">
                {{ e.entryType === 'PAID_LEAVE' ? 'Leave' : 'Regular' }}
              </span>
            </td>
            <td class="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{{ e.description || '-' }}</td>
            <td class="px-4 py-2 text-sm text-gray-900 text-right font-medium">{{ e.hours }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

const report = ref<any>(null)
const detailedEntries = ref<any[]>([])
const allProjects = ref<any[]>([])
const allUsers = ref<any[]>([])

const filters = reactive({
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  projectId: '',
  userId: '',
})

async function loadReport() {
  const params = new URLSearchParams()
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.projectId) params.set('projectId', filters.projectId)
  if (filters.userId) params.set('userId', filters.userId)

  const [summary, detailed] = await Promise.all([
    apiFetch<any>(`/reports/summary?${params}`),
    apiFetch<any[]>(`/reports/detailed?${params}`),
  ])

  report.value = summary
  detailedEntries.value = detailed
}

async function loadMeta() {
  const [p, u] = await Promise.all([
    apiFetch<any[]>('/projects'),
    apiFetch<any[]>('/users'),
  ])
  allProjects.value = p
  allUsers.value = u
}

function exportCSV() {
  if (!detailedEntries.value.length) return
  const headers = ['Date', 'Member', 'Email', 'Project', 'Type', 'Description', 'Hours']
  const rows = detailedEntries.value.map(e => [
    e.date, e.memberName, e.memberEmail, e.projectName || '', e.entryType, e.description || '', e.hours
  ])
  const csv = [headers, ...rows].map(r => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timesheet-report-${filters.startDate}-${filters.endDate}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadMeta()
  loadReport()
})
</script>
