<template>
  <div>
    <!-- Page Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Invoices</h1>
      <button @click="exportPDF" :disabled="lineItems.length === 0"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
        Download PDF
      </button>
    </div>

    <!-- Date Range Filter -->
    <div class="bg-white rounded-lg shadow-sm border p-4 mb-6 flex gap-4 items-end hide-in-pdf">
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
      <button @click="loadLineItems"
        class="px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
        Load
      </button>
    </div>

    <!-- Invoice Form (PDF source) -->
    <div ref="invoiceRef" class="bg-white rounded-lg shadow-sm border p-8">

      <!-- Invoice Header -->
      <div class="flex justify-between items-start mb-8">
        <h2 class="text-3xl font-bold text-gray-900">INVOICE</h2>
        <div class="text-right space-y-2">
          <div class="flex items-center justify-end gap-2">
            <label class="text-sm text-gray-500">#</label>
            <input v-model="invoice.number" type="text" placeholder="INV-001"
              class="invoice-input w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right" />
          </div>
          <div class="flex items-center justify-end gap-2">
            <label class="text-sm text-gray-500">Date</label>
            <input v-model="invoice.date" type="date"
              class="invoice-input w-40 px-2 py-1 border border-gray-300 rounded text-sm" />
          </div>
          <div class="flex items-center justify-end gap-2">
            <label class="text-sm text-gray-500">Due</label>
            <input v-model="invoice.dueDate" type="date"
              class="invoice-input w-40 px-2 py-1 border border-gray-300 rounded text-sm" />
          </div>
        </div>
      </div>

      <!-- From / Bill To -->
      <div class="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 class="text-xs font-semibold text-gray-500 uppercase mb-2">From</h3>
          <input v-model="invoice.fromName" type="text" placeholder="Your Name / Company"
            class="invoice-input w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1" />
          <input v-model="invoice.fromEmail" type="email" placeholder="your@email.com"
            class="invoice-input w-full px-2 py-1 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <h3 class="text-xs font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
          <input v-model="invoice.billToName" type="text" placeholder="Client Name"
            class="invoice-input w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1" />
          <input v-model="invoice.billToEmail" type="email" placeholder="client@email.com"
            class="invoice-input w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1" />
          <input v-model="invoice.billToCompany" type="text" placeholder="Client Company"
            class="invoice-input w-full px-2 py-1 border border-gray-300 rounded text-sm" />
        </div>
      </div>

      <!-- Line Items Table -->
      <table class="min-w-full mb-4">
        <thead>
          <tr class="bg-indigo-600 text-white">
            <th class="text-left text-xs font-semibold uppercase py-2 px-4">Description</th>
            <th class="text-right text-xs font-semibold uppercase py-2 px-4 w-24">Hours</th>
            <th class="text-right text-xs font-semibold uppercase py-2 px-4 w-28">Rate</th>
            <th class="text-right text-xs font-semibold uppercase py-2 px-4 w-32">Amount</th>
            <th class="w-10 hide-in-pdf"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in lineItems" :key="item.id" class="border-b border-gray-200">
            <td class="py-2 px-4">
              <input v-model="item.description" type="text"
                class="invoice-input w-full px-2 py-1 border border-gray-200 rounded text-sm" />
            </td>
            <td class="py-2 px-4">
              <input v-model.number="item.hours" type="number" step="0.01" min="0"
                @input="updateAmount(item)"
                class="invoice-input w-full px-2 py-1 border border-gray-200 rounded text-sm text-right" />
            </td>
            <td class="py-2 px-4">
              <input v-model.number="item.rate" type="number" step="0.01" min="0"
                @input="updateAmount(item)"
                class="invoice-input w-full px-2 py-1 border border-gray-200 rounded text-sm text-right" />
            </td>
            <td class="py-2 px-4 text-right text-sm font-semibold text-gray-900">
              {{ item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </td>
            <td class="py-2 pl-2 hide-in-pdf">
              <button @click="removeLineItem(index)" class="text-red-500 hover:text-red-700 text-lg">&times;</button>
            </td>
          </tr>
          <tr v-if="lineItems.length === 0">
            <td colspan="5" class="py-8 text-center text-gray-400 text-sm">
              No line items. Load from timesheet data or add manually.
            </td>
          </tr>
        </tbody>
      </table>

      <button @click="addLineItem" class="text-sm text-indigo-600 hover:text-indigo-800 mb-8 hide-in-pdf">
        + Add Line Item
      </button>

      <!-- Total -->
      <div class="flex justify-end border-t-2 border-gray-300 pt-4 mb-8">
        <div class="text-right">
          <span class="text-sm text-gray-500 mr-4">Total Amount:</span>
          <span class="text-2xl font-bold text-gray-900">
            {{ total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </span>
        </div>
      </div>

      <!-- Notes -->
      <div>
        <h3 class="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h3>
        <textarea v-model="invoice.notes" rows="3" placeholder="Additional notes..."
          class="invoice-input w-full px-3 py-2 border border-gray-300 rounded text-sm"></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import html2pdf from 'html2pdf.js'

const { apiFetch } = useApi()

interface LineItem {
  id: number
  description: string
  hours: number
  rate: number
  amount: number
}

const filters = reactive({
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
})

const invoice = reactive({
  number: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: '',
  fromName: '',
  fromEmail: '',
  billToName: '',
  billToEmail: '',
  billToCompany: '',
  notes: '',
})

let nextId = 1
const lineItems = ref<LineItem[]>([])
const invoiceRef = ref<HTMLElement | null>(null)
const loading = ref(false)

const total = computed(() =>
  lineItems.value.reduce((sum, item) => sum + item.amount, 0)
)

async function loadLineItems() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
    })
    const data = await apiFetch<Array<{
      description: string
      hours: number
    }>>(`/admin/invoices/line-items?${params}`)

    lineItems.value = data.map((item) => ({
      id: nextId++,
      description: item.description,
      hours: item.hours,
      rate: 0,
      amount: 0,
    }))
  } catch (e: any) {
    console.error('Failed to load line items:', e.message)
  } finally {
    loading.value = false
  }
}

function addLineItem() {
  lineItems.value.push({
    id: nextId++,
    description: '',
    hours: 0,
    rate: 0,
    amount: 0,
  })
}

function removeLineItem(index: number) {
  lineItems.value.splice(index, 1)
}

function updateAmount(item: LineItem) {
  item.amount = Math.round(item.hours * item.rate * 100) / 100
}

async function exportPDF() {
  if (!invoiceRef.value) return

  invoiceRef.value.classList.add('pdf-export-mode')

  const opt = {
    margin: 0.5,
    filename: `invoice-${invoice.number || 'draft'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
  }

  await html2pdf().set(opt).from(invoiceRef.value).save()

  invoiceRef.value.classList.remove('pdf-export-mode')
}

onMounted(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  invoice.number = `INV-${year}${month}-001`

  const due = new Date(now)
  due.setDate(due.getDate() + 30)
  invoice.dueDate = due.toISOString().split('T')[0]
})
</script>

<style scoped>
.pdf-export-mode .hide-in-pdf {
  display: none !important;
}

.pdf-export-mode .invoice-input {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}
</style>
