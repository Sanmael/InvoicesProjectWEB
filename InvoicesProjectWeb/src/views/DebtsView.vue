<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useDebtStore } from '@/stores/debt'
import { tagEventoService } from '@/services/tagEventoService'
import type { CreateDebtDto, CreateInstallmentDebtDto, CreateRecurringDebtDto, UpdateDebtDto, Debt, TagEvento } from '@/types'

const debtStore = useDebtStore()

const showModal = ref(false)
const showEditModal = ref(false)
const mode = ref<'simple' | 'installment' | 'recurring'>('simple')
const editingDebt = ref<Debt | null>(null)
const expandedInstallmentGroupIds = ref<Set<string>>(new Set())
const defaultStartMonth = new Date().toISOString().slice(0, 7)

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const selectedMonth = ref(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const yearMonths = monthNames.map((name, i) => ({
  label: name,
  value: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
}))

const categories = [
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer',
  'Vestuário', 'Assinaturas', 'Mercado', 'Pets', 'Presentes', 'Viagem',
  'Tecnologia', 'Serviços', 'Família', 'Investimentos', 'Impostos', 'Outros',
]

const eventOptions = ref<TagEvento[]>([])

const simpleForm = ref<CreateDebtDto>({
  description: '',
  amount: 0,
  dueDate: '',
  notes: '',
  category: 'Outros',
  tagEventoId: undefined,
})

const installmentForm = ref<CreateInstallmentDebtDto>({
  description: '',
  totalAmount: 0,
  firstDueDate: '',
  installments: 2,
  notes: '',
  category: 'Outros',
  tagEventoId: undefined,
})

const recurringForm = ref<CreateRecurringDebtDto & { startMonth: string }>({
  description: '',
  amount: 0,
  recurringDay: 5,
  months: 12,
  startMonth: defaultStartMonth,
  notes: '',
  category: 'Outros',
  tagEventoId: undefined,
})

const editForm = ref<UpdateDebtDto>({
  description: '',
  amount: 0,
  dueDate: '',
  notes: '',
  category: 'Outros',
  tagEventoId: undefined,
})

onMounted(() => {
  debtStore.fetchAll()
  loadEvents()
})

async function loadEvents() {
  eventOptions.value = await tagEventoService.getAll()
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const toInputDate = (dateStr: string) => dateStr ? (dateStr.split('T')[0] ?? '') : ''
const parseCivilDate = (dateStr: string) => {
  const parts = toInputDate(dateStr).split('-')
  const year = Number(parts[0]) || 0
  const month = Number(parts[1]) || 0
  const day = Number(parts[2]) || 0
  return { year, month, day, sortKey: year * 10000 + month * 100 + day }
}
const formatDate = (dateStr: string) => {
  const { year, month, day } = parseCivilDate(dateStr)
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

type DebtListItem =
  | { kind: 'single'; item: Debt }
  | { kind: 'group'; groupId: string; groupType: 'installment' | 'recurring'; items: Debt[]; representative: Debt }

const buttonLoading = ref(false);

const groupedDebts = computed<DebtListItem[]>(() => {
  const list = debtStore.debts
  const seenGroupIds = new Set<string>()
  const result: DebtListItem[] = []

  for (const debt of list) {
    if (debt.installmentGroupId) {
      const groupId = debt.installmentGroupId
      if (seenGroupIds.has(groupId)) {
        continue
      }

      const items = list
        .filter((d) => d.installmentGroupId === groupId)
        .sort((a, b) => parseCivilDate(a.dueDate).sortKey - parseCivilDate(b.dueDate).sortKey)

      if (items.length === 0) {
        continue
      }

      const representative = (items.find((d) => !d.isPaid) ?? items[0]) as Debt
      const groupType: 'installment' | 'recurring' = items.some((d) => d.isInstallment)
        ? 'installment'
        : 'recurring'

      result.push({ kind: 'group', groupId, groupType, items, representative })
      seenGroupIds.add(groupId)
      continue
    }

    result.push({ kind: 'single', item: debt })
  }

  return result
})

function getSortDate(entry: DebtListItem): number {
  if (entry.kind === 'single') {
    return parseCivilDate(entry.item.dueDate).sortKey
  }
  return parseCivilDate(entry.representative.dueDate).sortKey
}

function isEntryPaid(entry: DebtListItem): boolean {
  if (entry.kind === 'single') return entry.item.isPaid
  return entry.representative.isPaid
}

const filteredGroupedDebts = computed<DebtListItem[]>(() => {
  let list = groupedDebts.value

  if (selectedMonth.value) {
    const [year, month] = selectedMonth.value.split('-').map(Number)
    if (year && month) {
      list = list
        .filter((entry) => {
          if (entry.kind === 'single') {
            const d = parseCivilDate(entry.item.dueDate)
            return d.year === year && d.month === month
          }
          return entry.items.some((d) => {
            const date = parseCivilDate(d.dueDate)
            return date.year === year && date.month === month
          })
        })
        .map((entry) => {
          if (entry.kind === 'group') {
            const monthItem = entry.items.find((d) => {
              const dt = parseCivilDate(d.dueDate)
              return dt.year === year && dt.month === month
            })
            if (monthItem) {
              return { ...entry, representative: monthItem }
            }
          }
          return entry
        })
    }
  }

  return [...list].sort((a, b) => {
    const aPaid = isEntryPaid(a)
    const bPaid = isEntryPaid(b)
    if (aPaid !== bPaid) return aPaid ? 1 : -1
    return getSortDate(a) - getSortDate(b)
  })
})

const isGroupExpanded = (groupId: string) => expandedInstallmentGroupIds.value.has(groupId)

function toggleGroup(groupId: string) {
  const updated = new Set(expandedInstallmentGroupIds.value)
  if (updated.has(groupId)) {
    updated.delete(groupId)
  } else {
    updated.add(groupId)
  }
  expandedInstallmentGroupIds.value = updated
}

function openModal() {
  mode.value = 'simple'
  simpleForm.value = { description: '', amount: 0, dueDate: '', notes: '', category: 'Outros', tagEventoId: undefined }
  installmentForm.value = { description: '', totalAmount: 0, firstDueDate: '', installments: 2, notes: '', category: 'Outros', tagEventoId: undefined }
  recurringForm.value = { description: '', amount: 0, recurringDay: 5, months: 12, startMonth: defaultStartMonth, notes: '', category: 'Outros', tagEventoId: undefined }
  showModal.value = true
}

function openEditModal(debt: Debt) {
  editingDebt.value = debt
  editForm.value = {
    description: debt.description,
    amount: debt.amount,
    dueDate: toInputDate(debt.dueDate),
    notes: debt.notes ?? '',
    category: debt.category ?? 'Outros',
    tagEventoId: debt.tagEventoId ?? undefined,
  }
  showEditModal.value = true
}

async function handleSubmit() {
 try{
  buttonLoading.value = true;

  if (mode.value === 'installment') {
    await debtStore.createInstallment(installmentForm.value)
  } else if (mode.value === 'recurring') {
    await debtStore.createRecurring({
      description: recurringForm.value.description,
      amount: recurringForm.value.amount,
      recurringDay: recurringForm.value.recurringDay,
      months: recurringForm.value.months,
      startDate: recurringForm.value.startMonth ? `${recurringForm.value.startMonth}-01` : undefined,
      notes: recurringForm.value.notes,
      category: recurringForm.value.category,
      tagEventoId: recurringForm.value.tagEventoId,
    })
  } else {
    await debtStore.create(simpleForm.value)
  }
  showModal.value = false;
 }
 finally{
  buttonLoading.value = false;
 }
}

async function handleEditSubmit() {
  if (!editingDebt.value) return
  buttonLoading.value = true
  try {
    await debtStore.update(editingDebt.value.id, editForm.value)
    showEditModal.value = false
    editingDebt.value = null
  } finally {
    buttonLoading.value = false
  }
}

async function handleMarkAsPaid(id: string) {
  buttonLoading.value = true
  try {
    await debtStore.markAsPaid(id)
  } finally {
    buttonLoading.value = false
  }
}

async function handleDelete(id: string) {
  if (confirm('Tem certeza que deseja excluir esta despesa?')) {
    buttonLoading.value = true
    try {
      await debtStore.remove(id)
    } finally {
      buttonLoading.value = false
    }
  }
}

async function handleDeleteGroup(groupId: string) {
  if (confirm('Cancelar todas as despesas não pagas deste lote?')) {
    buttonLoading.value = true
    try {
      await debtStore.removeGroup(groupId)
    } finally {
      buttonLoading.value = false
    }
  }
}
</script>

<template>
  <div class="debts-page">
    <header class="page-header">
      <div>
        <h1>📉 Despesas</h1>
        <p>Gerencie suas contas a pagar</p>
      </div>
      <div class="header-actions">
        <button @click="openModal" class="btn-primary">+ Nova Despesa</button>
      </div>
    </header>

    <div class="month-buttons">
      <button
        v-for="m in yearMonths"
        :key="m.value"
        :class="['month-btn', { active: selectedMonth === m.value }]"
        @click="selectedMonth = selectedMonth === m.value ? '' : m.value"
      >
        {{ m.label }}
      </button>
    </div>

    <div v-if="debtStore.loading" class="loading">Carregando...</div>

    <div v-else-if="debtStore.error" class="error-alert">
      {{ debtStore.error }}
    </div>

    <div v-else-if="debtStore.debts.length === 0" class="empty-state">
      <p>Nenhuma despesa cadastrada</p>
      <button @click="openModal" class="btn-primary">Criar primeira despesa</button>
    </div>

    <div v-else-if="filteredGroupedDebts.length === 0" class="empty-state">
      <p>Nenhuma despesa encontrada para este mês</p>
    </div>

    <div v-else class="debts-list">
      <div
        v-for="entry in filteredGroupedDebts"
        :key="entry.kind === 'group' ? `group-${entry.groupId}` : entry.item.id"
        class="debt-wrapper"
      >
        <div
          class="debt-card"
          :class="{ paid: entry.kind === 'single' ? entry.item.isPaid : entry.representative.isPaid }"
        >
          <div class="debt-info">
            <div class="debt-title-row">
              <h3>{{ entry.kind === 'single' ? entry.item.description : entry.representative.description }}</h3>
              <span v-if="entry.kind === 'group' && entry.groupType === 'installment'" class="badge badge-installment">
                Parcelado ({{ entry.items.length }}x)
              </span>
              <span v-else-if="entry.kind === 'group' && entry.groupType === 'recurring'" class="badge badge-recurring">
                Recorrente ({{ entry.items.length }}x)
              </span>
              <span v-else-if="entry.kind === 'single' && entry.item.isInstallment" class="badge badge-installment">
                Parcela {{ entry.item.installmentNumber }}/{{ entry.item.totalInstallments }}
              </span>
              <span v-else-if="entry.kind === 'single' && entry.item.installmentGroupId" class="badge badge-recurring">
                Recorrente
              </span>
              <span class="badge badge-category">
                {{ entry.kind === 'single' ? (entry.item.category ?? 'Outros') : (entry.representative.category ?? 'Outros') }}
              </span>
            </div>
            <p class="debt-date" v-if="entry.kind === 'single'">
              Vencimento: {{ formatDate(entry.item.dueDate) }}
            </p>
            <p class="debt-date" v-else>
              Próxima/mais recente: {{ formatDate(entry.representative.dueDate) }}
            </p>
            <p v-if="entry.kind === 'single' && entry.item.notes" class="debt-notes">{{ entry.item.notes }}</p>
            <p v-else-if="entry.kind === 'group'" class="debt-notes">
              {{
                isGroupExpanded(entry.groupId)
                  ? entry.groupType === 'installment' ? 'Parcelas expandidas.' : 'Recorrências expandidas.'
                  : entry.groupType === 'installment'
                    ? `Mais ${entry.items.length - 1} parcela(s) ocultas.`
                    : `Mais ${entry.items.length - 1} recorrência(s) ocultas.`
              }}
            </p>
          </div>
          <div class="debt-actions">
            <span class="debt-amount">
              {{ formatCurrency(entry.kind === 'single' ? entry.item.amount : entry.representative.amount) }}
            </span>
            <div class="action-buttons" v-if="entry.kind === 'single'">
              <button
                v-if="!entry.item.isPaid"
                @click="handleMarkAsPaid(entry.item.id)"
                class="btn-action btn-success"
                title="Marcar como pago"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <span v-else class="paid-badge">Pago</span>
              <button
                @click="openEditModal(entry.item)"
                class="btn-action btn-edit"
                title="Editar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                v-if="entry.item.isInstallment && entry.item.installmentGroupId && !entry.item.isPaid"
                @click="handleDeleteGroup(entry.item.installmentGroupId)"
                class="btn-action btn-warning"
                title="Cancelar lote"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <button @click="handleDelete(entry.item.id)" class="btn-action btn-danger" title="Excluir">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            <div class="action-buttons" v-else>
              <span v-if="entry.representative.isPaid" class="paid-badge">Pago</span>
              <button
                v-else
                @click="handleMarkAsPaid(entry.representative.id)"
                class="btn-action btn-success"
                title="Marcar como pago"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button class="btn-action btn-outline" @click="toggleGroup(entry.groupId)">
                {{ isGroupExpanded(entry.groupId) ? 'Ocultar' : 'Abrir' }}
              </button>
              <button
                v-if="entry.items.some((d) => !d.isPaid)"
                @click="handleDeleteGroup(entry.groupId)"
                class="btn-action btn-warning"
                title="Cancelar lote"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="entry.kind === 'group' && isGroupExpanded(entry.groupId)"
          class="group-items"
        >
          <div
            v-for="debt in entry.items"
            :key="debt.id"
            class="debt-card debt-card-child"
            :class="{ paid: debt.isPaid }"
          >
            <div class="debt-info">
              <div class="debt-title-row">
                <h3>{{ debt.description }}</h3>
                <span v-if="entry.groupType === 'installment'" class="badge badge-installment">
                  Parcela {{ debt.installmentNumber }}/{{ debt.totalInstallments }}
                </span>
                <span v-else class="badge badge-recurring">
                  Recorrente
                </span>
              </div>
              <p class="debt-date">Vencimento: {{ formatDate(debt.dueDate) }}</p>
              <p v-if="debt.notes" class="debt-notes">{{ debt.notes }}</p>
            </div>
            <div class="debt-actions">
              <span class="debt-amount">{{ formatCurrency(debt.amount) }}</span>
              <div class="action-buttons">
                <button
                  v-if="!debt.isPaid"
                  @click="handleMarkAsPaid(debt.id)"
                  class="btn-action btn-success"
                  title="Marcar como pago"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
                <span v-else class="paid-badge">Pago</span>
                <button
                  @click="openEditModal(debt)"
                  class="btn-action btn-edit"
                  title="Editar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button @click="handleDelete(debt.id)" class="btn-action btn-danger" title="Excluir">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Nova Despesa -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Nova Despesa</h2>
          <button type="button" class="close-btn" @click="showModal = false">✕</button>
        </div>

        <div class="mode-selector">
          <button :class="['mode-btn', { active: mode === 'simple' }]" type="button" @click="mode = 'simple'">Despesa simples</button>
          <button :class="['mode-btn', { active: mode === 'installment' }]" type="button" @click="mode = 'installment'">Parcelado</button>
          <button :class="['mode-btn', { active: mode === 'recurring' }]" type="button" @click="mode = 'recurring'">Recorrente</button>
        </div>

        <form v-if="mode === 'simple'" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Descrição</label>
            <input v-model="simpleForm.description" required />
          </div>
          <div class="form-group">
            <label>Valor</label>
            <input v-model.number="simpleForm.amount" type="number" step="0.01" min="0" required />
          </div>
          <div class="form-group">
            <label>Data de Vencimento</label>
            <input v-model="simpleForm.dueDate" type="date" required />
          </div>
          <div class="form-group">
            <label>Categoria</label>
            <select v-model="simpleForm.category">
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Evento (opcional)</label>
            <select v-model="simpleForm.tagEventoId">
              <option :value="undefined">Sem evento</option>
              <option v-for="event in eventOptions" :key="event.id" :value="event.id">{{ event.nome }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Observações</label>
            <textarea v-model="simpleForm.notes" rows="2"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showModal = false" class="btn-secondary">Cancelar</button>
            <button type="submit" :disabled="buttonLoading" class="btn-primary">{{ buttonLoading ? 'Salvando...' : 'Salvar' }}</button>
          </div>
        </form>

        <form v-else-if="mode === 'installment'" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Descrição (ex: Dívida com João)</label>
            <input v-model="installmentForm.description" required />
          </div>
          <div class="form-group">
            <label>Valor total da dívida</label>
            <input v-model.number="installmentForm.totalAmount" type="number" step="0.01" min="0" required />
          </div>
          <div class="form-group">
            <label>Vencimento da 1ª parcela</label>
            <input v-model="installmentForm.firstDueDate" type="date" required />
          </div>
          <div class="form-group">
            <label>Número de parcelas (2-60)</label>
            <input v-model.number="installmentForm.installments" type="number" min="2" max="60" required />
          </div>
          <div v-if="installmentForm.totalAmount > 0 && installmentForm.installments > 0" class="installment-preview">
            Valor por parcela: <strong>{{ formatCurrency(installmentForm.totalAmount / installmentForm.installments) }}</strong>
          </div>
          <div class="form-group">
            <label>Categoria</label>
            <select v-model="installmentForm.category">
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Evento (opcional)</label>
            <select v-model="installmentForm.tagEventoId">
              <option :value="undefined">Sem evento</option>
              <option v-for="event in eventOptions" :key="event.id" :value="event.id">{{ event.nome }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Observações</label>
            <textarea v-model="installmentForm.notes" rows="2"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showModal = false" class="btn-secondary">Cancelar</button>
            <button type="submit" :disabled="buttonLoading" class="btn-primary">{{ buttonLoading ? 'Gerando...' : 'Gerar parcelas' }}</button>
          </div>
        </form>

        <form v-else @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Descrição (ex: Ajuda familiar)</label>
            <input v-model="recurringForm.description" required />
          </div>
          <div class="form-group">
            <label>Valor mensal</label>
            <input v-model.number="recurringForm.amount" type="number" step="0.01" min="0" required />
          </div>
          <div class="form-group">
            <label>Dia fixo do mês (1-28)</label>
            <input v-model.number="recurringForm.recurringDay" type="number" min="1" max="28" required />
          </div>
          <div class="form-group">
            <label>Mês de início</label>
            <input v-model="recurringForm.startMonth" type="month" required />
          </div>
          <div class="form-group">
            <label>Quantidade de meses (1-60)</label>
            <input v-model.number="recurringForm.months" type="number" min="1" max="60" required />
          </div>
          <div class="recurring-preview">
            Serão geradas <strong>{{ recurringForm.months }}</strong> despesas mensais de
            <strong>{{ formatCurrency(recurringForm.amount) }}</strong>, todo dia
            <strong>{{ recurringForm.recurringDay }}</strong>.
          </div>
          <div class="form-group">
            <label>Categoria</label>
            <select v-model="recurringForm.category">
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Evento (opcional)</label>
            <select v-model="recurringForm.tagEventoId">
              <option :value="undefined">Sem evento</option>
              <option v-for="event in eventOptions" :key="event.id" :value="event.id">{{ event.nome }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Observações</label>
            <textarea v-model="recurringForm.notes" rows="2"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showModal = false" class="btn-secondary">Cancelar</button>
            <button type="submit" :disabled="buttonLoading" class="btn-primary">{{ buttonLoading ? 'Gerando...' : 'Gerar recorrência' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Editar Despesa -->
    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Editar Despesa</h2>
          <button type="button" class="close-btn" @click="showEditModal = false">✕</button>
        </div>
        <form @submit.prevent="handleEditSubmit">
          <div class="form-group">
            <label>Descrição</label>
            <input v-model="editForm.description" required />
          </div>
          <div class="form-group">
            <label>Valor</label>
            <input v-model.number="editForm.amount" type="number" step="0.01" min="0" required />
          </div>
          <div class="form-group">
            <label>Data de Vencimento</label>
            <input v-model="editForm.dueDate" type="date" required />
          </div>
          <div class="form-group">
            <label>Categoria</label>
            <select v-model="editForm.category">
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Evento (opcional)</label>
            <select v-model="editForm.tagEventoId">
              <option :value="undefined">Sem evento</option>
              <option v-for="event in eventOptions" :key="event.id" :value="event.id">{{ event.nome }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Observações</label>
            <textarea v-model="editForm.notes" rows="2"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showEditModal = false" class="btn-secondary">Cancelar</button>
            <button type="submit" :disabled="buttonLoading" class="btn-primary">{{ buttonLoading ? 'Salvando...' : 'Salvar' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debts-page { max-width: 900px; margin: 0 auto; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.page-header h1 { margin: 0; color: var(--text-primary); }
.page-header p { margin: 0.25rem 0 0; color: var(--text-secondary); }

.header-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

.month-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.month-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--input-border);
  border-radius: 999px;
  background: var(--card-bg);
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.month-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.month-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover { 
  background: var(--color-primary-hover);
  transform: translateY(-2px); 
}

.loading, .empty-state { 
  text-align: center; 
  padding: 3rem; 
  color: var(--text-secondary); 
}

.debts-list { display: flex; flex-direction: column; gap: 1rem; }

.debt-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.debt-card {
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--color-danger);
  transition: background-color 0.3s ease;
}
.debt-card.paid { 
  border-left-color: var(--color-success); 
  opacity: 0.75; 
}

.debt-title-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.debt-title-row h3 { margin: 0; color: var(--text-primary); }

.badge { font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 999px; }
.badge-installment { background: var(--color-warning-bg); color: var(--color-warning); }
.badge-recurring { background: var(--color-info-bg); color: var(--color-info); }
.badge-category { background: var(--color-secondary-bg, #e8e8e8); color: var(--text-secondary); }

.debt-date { color: var(--text-secondary); font-size: 0.9rem; margin: 0.25rem 0 0; }
.debt-notes { color: var(--text-muted); font-size: 0.85rem; margin: 0.5rem 0 0; }

.debt-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.debt-amount { font-size: 1.25rem; font-weight: 700; color: var(--color-danger); }
.debt-card.paid .debt-amount { color: var(--color-success); }

.action-buttons { display: flex; gap: 0.5rem; }

.btn-action {
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-outline {
  width: auto;
  padding: 0 0.9rem;
  background: transparent;
  border: 1px solid var(--input-border);
  color: var(--text-primary);
  font-weight: 600;
}

.btn-action:hover {
  transform: scale(1.1);
}

.btn-success { 
  background: var(--color-success); 
  color: white;
}
.btn-success:hover { 
  background: var(--color-success-hover); 
}

.btn-edit { 
  background: var(--color-info); 
  color: white; 
}
.btn-edit:hover { 
  background: #0369a1; 
}

.btn-warning { 
  background: var(--color-warning); 
  color: white;
}
.btn-warning:hover { 
  background: #b45309; 
}

.btn-danger { 
  background: var(--color-danger); 
  color: white;
}
.btn-danger:hover { 
  background: var(--color-danger-hover); 
}

.paid-badge {
  background: var(--color-success-bg);
  color: var(--color-success);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 1rem;
  border-left: 2px dashed var(--input-border);
}

.debt-card-child {
  border-left-color: rgba(245, 158, 11, 0.5);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 2rem;
  width: 100%;
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.modal-header h2 { margin: 0; color: var(--text-primary); }
.close-btn { 
  background: none; 
  border: none; 
  font-size: 1.5rem; 
  cursor: pointer; 
  color: var(--text-muted); 
  padding: 0.25rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius);
}
.close-btn:hover { 
  color: var(--text-primary); 
  background: var(--border-color);
}

.mode-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  padding: 4px;
}
.mode-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.mode-btn.active { 
  background: var(--card-bg); 
  color: var(--text-primary); 
  box-shadow: var(--shadow-sm); 
}

.installment-preview {
  background: var(--color-warning-bg);
  border-radius: var(--border-radius);
  padding: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--color-warning);
}

.recurring-preview {
  background: var(--color-info-bg);
  border-radius: var(--border-radius);
  padding: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--color-info);
}

.form-group { margin-bottom: 1rem; }
.form-group label { 
  display: block; 
  margin-bottom: 0.5rem; 
  font-weight: 500; 
  color: var(--text-primary); 
}
.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--input-border);
  border-radius: var(--border-radius);
  font-size: 1rem;
  box-sizing: border-box;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}
.form-group select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}
.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus { 
  outline: none; 
  border-color: var(--color-primary); 
}

.modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
.btn-secondary {
  flex: 1;
  padding: 0.75rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}
.btn-secondary:hover {
  background: var(--border-color);
}
.modal-actions .btn-primary { flex: 1; }

/* Responsivo */
@media (max-width: 640px) {
  .debt-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .debt-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .modal {
    padding: 1.5rem;
    margin: 0.5rem;
  }
}
</style>
