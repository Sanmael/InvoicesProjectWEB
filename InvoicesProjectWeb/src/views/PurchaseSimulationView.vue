<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { creditCardService } from '@/services/creditCardService'
import { purchaseSimulationService } from '@/services/purchaseSimulationService'
import { useToast } from '@/composables/useToast'
import type {
  CreditCard,
  SimulationItem,
  SimulationPlanRequest,
  SimulationAllocation,
  PurchaseSimulationResult,
  SimulationPlanResult,
} from '@/types'

const { showToast } = useToast()
const cards = ref<CreditCard[]>([])
const loading = ref(false)
const result = ref<PurchaseSimulationResult | null>(null)
const activePlanIndex = ref(0)

// --- Form: Items ---
const items = ref<SimulationItem[]>([
  { description: '', quantity: 1, unitPrice: 0 },
])

// --- Form: Plans ---
interface PlanForm {
  label: string
  allocations: (SimulationAllocation & { _key: number })[]
}

let allocKey = 0
function newAlloc(): SimulationAllocation & { _key: number } {
  return { creditCardId: '', amount: 0, installments: 1, _key: allocKey++ }
}

const plans = ref<PlanForm[]>([
  { label: 'Plano 1', allocations: [newAlloc()] },
])

const projectionMonths = ref(12)

// --- Start month ---
const now = new Date()
const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2).padStart(2, '0')}`
const startMonth = ref(defaultStart)

const startMonthOptions = computed(() => {
  const options: { value: string; label: string }[] = []
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    options.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `${months[m - 1]}/${y}` })
  }
  return options
})

const totalAmount = computed(() =>
  items.value.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
)

// --- Item helpers ---
function addItem() {
  items.value.push({ description: '', quantity: 1, unitPrice: 0 })
}
function removeItem(idx: number) {
  if (items.value.length > 1) items.value.splice(idx, 1)
}

// --- Plan helpers ---
function addPlan() {
  plans.value.push({ label: `Plano ${plans.value.length + 1}`, allocations: [newAlloc()] })
}
function removePlan(idx: number) {
  if (plans.value.length > 1) {
    plans.value.splice(idx, 1)
    if (activePlanIndex.value >= plans.value.length) activePlanIndex.value = 0
  }
}
function addAllocation(planIdx: number) {
  plans.value[planIdx].allocations.push(newAlloc())
}
function removeAllocation(planIdx: number, allocIdx: number) {
  if (plans.value[planIdx].allocations.length > 1) {
    plans.value[planIdx].allocations.splice(allocIdx, 1)
  }
}

function planAllocatedTotal(plan: PlanForm) {
  return plan.allocations.reduce((s, a) => s + (a.amount || 0), 0)
}
function planRemaining(plan: PlanForm) {
  return totalAmount.value - planAllocatedTotal(plan)
}

function fillRemaining(planIdx: number, allocIdx: number) {
  const plan = plans.value[planIdx]
  const otherSum = plan.allocations.reduce((s, a, i) => i === allocIdx ? s : s + (a.amount || 0), 0)
  plan.allocations[allocIdx].amount = Math.max(0, Math.round((totalAmount.value - otherSum) * 100) / 100)
}

// --- Formatting ---
function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function balanceClass(value: number) {
  if (value < 0) return 'negative'
  if (value < 500) return 'tight'
  return 'positive'
}

function cardLabel(cardId: string) {
  const c = cards.value.find(c => c.id === cardId)
  return c ? `${c.name} •••• ${c.lastFourDigits}` : 'Selecione'
}

function cardAvailableLimit(cardId: string): number | null {
  if (!result.value) return null
  const info = result.value.availableCards.find(c => c.id === cardId)
  return info?.availableLimit ?? null
}

// --- Simulate ---
async function simulate() {
  const validItems = items.value.filter(i => i.description.trim() && i.unitPrice > 0)
  if (validItems.length === 0) {
    showToast('Adicione pelo menos um item com descrição e valor.', 'error')
    return
  }
  for (const plan of plans.value) {
    if (plan.allocations.some(a => !a.creditCardId)) {
      showToast(`"${plan.label}": selecione um cartão em cada alocação.`, 'error')
      return
    }
  }

  loading.value = true
  result.value = null
  try {
    const [sy, sm] = startMonth.value.split('-').map(Number)
    const payload = {
      items: validItems,
      plans: plans.value.map(p => ({
        label: p.label,
        allocations: p.allocations.map(a => ({
          creditCardId: a.creditCardId,
          amount: a.amount,
          installments: a.installments,
        })),
      })),
      projectionMonths: projectionMonths.value,
      startYear: sy,
      startMonth: sm,
    }
    result.value = await purchaseSimulationService.simulate(payload)
    activePlanIndex.value = 0
  } catch {
    showToast('Erro ao simular compra.', 'error')
  } finally {
    loading.value = false
  }
}

const activePlan = computed<SimulationPlanResult | null>(
  () => result.value?.plans[activePlanIndex.value] ?? null,
)

onMounted(async () => {
  try {
    cards.value = await creditCardService.getAll()
  } catch { /* silent */ }
})
</script>

<template>
  <div class="simulation-container">
    <header class="page-header">
      <h1>🧪 Simulação de Compra</h1>
      <p class="page-subtitle">
        Simule uma compra e veja como ficam suas finanças — sem inserir nada no banco.
      </p>
    </header>

    <!-- Items Section -->
    <section class="form-section">
      <h2>📦 Itens da Compra</h2>
      <div class="items-list">
        <div v-for="(item, idx) in items" :key="idx" class="item-row">
          <input v-model="item.description" type="text" placeholder="Descrição (ex: Monitor 27'')" class="input description-input" />
          <input v-model.number="item.quantity" type="number" min="1" placeholder="Qtd" class="input qty-input" />
          <div class="price-input-wrapper">
            <span class="price-prefix">R$</span>
            <input v-model.number="item.unitPrice" type="number" min="0" step="0.01" placeholder="0,00" class="input price-input" />
          </div>
          <span class="item-subtotal">{{ fmt(item.quantity * item.unitPrice) }}</span>
          <button v-if="items.length > 1" class="btn-remove" @click="removeItem(idx)" title="Remover item">✕</button>
        </div>
      </div>
      <div class="items-footer">
        <button class="btn-add" @click="addItem">+ Adicionar item</button>
        <div class="total-badge">Total: <strong>{{ fmt(totalAmount) }}</strong></div>
      </div>
    </section>

    <!-- Available Cards Info (always visible) -->
    <section v-if="cards.length > 0" class="form-section cards-overview-section">
      <h2>💳 Seus Cartões — Limites Disponíveis</h2>
      <div class="cards-overview-grid">
        <div v-for="card in cards" :key="card.id" class="card-limit-box"
             :class="{ 'limit-ok': card.availableLimit !== null && card.availableLimit >= totalAmount, 'limit-low': card.availableLimit !== null && card.availableLimit < totalAmount }">
          <div class="card-limit-name">{{ card.name }} <span class="card-digits">•••• {{ card.lastFourDigits }}</span></div>
          <div class="card-limit-row">
            <span class="card-limit-label">Limite total</span>
            <span>{{ card.creditLimit !== null ? fmt(card.creditLimit) : '—' }}</span>
          </div>
          <div class="card-limit-row">
            <span class="card-limit-label">Usado</span>
            <span class="negative">{{ fmt(card.totalPending) }}</span>
          </div>
          <div class="card-limit-row available-row">
            <span class="card-limit-label">Disponível</span>
            <span :class="card.availableLimit !== null && card.availableLimit >= totalAmount ? 'positive' : 'negative'">
              {{ card.availableLimit !== null ? fmt(card.availableLimit) : '—' }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Plans Section -->
    <section class="form-section">
      <h2>📋 Planos de Pagamento</h2>
      <p class="section-hint">
        Distribua o valor total entre seus cartões. Cada plano é uma combinação diferente para você comparar.
      </p>

      <div class="plans-list">
        <div v-for="(plan, pIdx) in plans" :key="pIdx" class="plan-card">
          <div class="plan-header-row">
            <input v-model="plan.label" type="text" class="input plan-label-input" placeholder="Nome do plano" />
            <div class="plan-allocated-info">
              <span v-if="totalAmount > 0"
                    :class="planRemaining(plan) > 0.01 ? 'remaining-warn' : planRemaining(plan) < -0.01 ? 'remaining-over' : 'remaining-ok'">
                {{ planRemaining(plan) > 0.01 ? `Falta: ${fmt(planRemaining(plan))}` : planRemaining(plan) < -0.01 ? `Excede: ${fmt(-planRemaining(plan))}` : '✓ Valor coberto' }}
              </span>
            </div>
            <button v-if="plans.length > 1" class="btn-remove" @click="removePlan(pIdx)" title="Remover plano">✕</button>
          </div>

          <div class="alloc-list">
            <div v-for="(alloc, aIdx) in plan.allocations" :key="alloc._key" class="alloc-row">
              <select v-model="alloc.creditCardId" class="input select-card">
                <option value="" disabled>Selecione o cartão</option>
                <option v-for="card in cards" :key="card.id" :value="card.id">
                  {{ card.name }} •••• {{ card.lastFourDigits }}
                </option>
              </select>
              <div class="alloc-amount-group">
                <div class="price-input-wrapper">
                  <span class="price-prefix">R$</span>
                  <input v-model.number="alloc.amount" type="number" min="0" step="0.01" class="input price-input" placeholder="Valor" />
                </div>
                <button class="btn-fill" @click="fillRemaining(pIdx, aIdx)" title="Preencher com o restante">Restante</button>
              </div>
              <div class="installments-group">
                <input v-model.number="alloc.installments" type="number" min="1" max="48" class="input installments-input" />
                <span class="installments-label">x</span>
                <span v-if="alloc.amount > 0 && alloc.installments > 0" class="installment-preview">
                  {{ fmt(alloc.amount / alloc.installments) }}
                </span>
              </div>
              <button v-if="plan.allocations.length > 1" class="btn-remove" @click="removeAllocation(pIdx, aIdx)" title="Remover">✕</button>
            </div>
          </div>
          <button class="btn-add btn-add-alloc" @click="addAllocation(pIdx)">+ Adicionar cartão neste plano</button>
        </div>
      </div>
      <button class="btn-add" @click="addPlan">+ Adicionar plano para comparar</button>
    </section>

    <!-- Projection + Start Month + Simulate -->
    <section class="form-section inline-section">
      <div class="projection-controls">
        <label class="projection-label">
          A partir de
          <select v-model="startMonth" class="input projection-select">
            <option v-for="opt in startMonthOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <label class="projection-label">
          por
          <select v-model.number="projectionMonths" class="input projection-select">
            <option :value="3">3 meses</option>
            <option :value="6">6 meses</option>
            <option :value="12">12 meses</option>
            <option :value="24">24 meses</option>
          </select>
        </label>
      </div>
      <button class="btn-simulate" :disabled="loading" @click="simulate">
        <span v-if="loading" class="spinner"></span>
        {{ loading ? 'Simulando...' : '🚀 Simular' }}
      </button>
    </section>

    <!-- Results -->
    <div v-if="result" class="results-section">
      <h2>📊 Resultado da Simulação</h2>

      <!-- Items Summary -->
      <div class="result-items">
        <div v-for="item in result.items" :key="item.description" class="result-item-row">
          <span class="result-item-desc">{{ item.quantity }}x {{ item.description }}</span>
          <span class="result-item-price">{{ fmt(item.subtotal) }}</span>
        </div>
        <div class="result-item-row total-row">
          <span class="result-item-desc"><strong>Total da compra</strong></span>
          <span class="result-item-price"><strong>{{ fmt(result.totalAmount) }}</strong></span>
        </div>
      </div>

      <!-- Plan Tabs -->
      <div v-if="result.plans.length > 1" class="plan-tabs">
        <button v-for="(pl, idx) in result.plans" :key="idx"
                class="plan-tab" :class="{ active: activePlanIndex === idx, 'has-issues': pl.hasLimitIssues }"
                @click="activePlanIndex = idx">
          {{ pl.label }}
          <span v-if="pl.hasLimitIssues" class="tab-warn">⚠️</span>
        </button>
      </div>

      <!-- Active Plan Detail -->
      <div v-if="activePlan" class="plan-detail">
        <!-- Allocations -->
        <div class="alloc-results">
          <h3>Distribuição nos Cartões</h3>
          <div class="alloc-result-grid">
            <div v-for="a in activePlan.allocations" :key="a.creditCardId"
                 class="alloc-result-card" :class="{ 'exceeds': a.exceedsLimit }">
              <div class="alloc-card-name">
                💳 {{ a.cardName }}
                <span class="card-digits">•••• {{ a.lastFourDigits }}</span>
              </div>
              <div class="alloc-card-stats">
                <div class="alloc-stat">
                  <span class="alloc-stat-label">Valor</span>
                  <span class="alloc-stat-value">{{ fmt(a.amount) }}</span>
                </div>
                <div class="alloc-stat">
                  <span class="alloc-stat-label">Parcelas</span>
                  <span class="alloc-stat-value">{{ a.installments }}x {{ fmt(a.installmentValue) }}</span>
                </div>
                <div class="alloc-stat">
                  <span class="alloc-stat-label">Limite disponível</span>
                  <span class="alloc-stat-value" :class="a.exceedsLimit ? 'negative' : 'positive'">
                    {{ a.availableLimit !== null ? fmt(a.availableLimit) : '—' }}
                  </span>
                </div>
              </div>
              <div v-if="a.exceedsLimit" class="alloc-warning">
                ⚠️ Excede o limite disponível em {{ fmt(a.amount - (a.availableLimit ?? 0)) }}
              </div>
            </div>
          </div>

          <!-- Summary badges -->
          <div class="plan-summary-badges">
            <span class="summary-badge" :class="activePlan.unallocated > 0.01 ? 'badge-warn' : activePlan.unallocated < -0.01 ? 'badge-error' : 'badge-ok'">
              {{ activePlan.unallocated > 0.01 ? `⚠️ Falta distribuir: ${fmt(activePlan.unallocated)}` : activePlan.unallocated < -0.01 ? `⚠️ Excede em: ${fmt(-activePlan.unallocated)}` : '✅ Valor totalmente coberto' }}
            </span>
            <span v-if="activePlan.hasLimitIssues" class="summary-badge badge-error">
              ⚠️ Algum cartão não tem limite suficiente
            </span>
          </div>
        </div>

        <!-- Monthly Projection Table -->
        <h3>Projeção Mensal</h3>
        <div class="table-wrapper">
          <table class="projection-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Receitas</th>
                <th>Débitos</th>
                <th>Cartões (atual)</th>
                <th>+ Simulação</th>
                <th>Total Saídas</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in activePlan.monthlyProjections" :key="`${m.year}-${m.month}`"
                  :class="{ 'has-simulation': m.simulatedInstallment > 0 }">
                <td class="month-cell">{{ m.label }}</td>
                <td class="positive">{{ fmt(m.totalReceivables) }}</td>
                <td class="negative">{{ fmt(m.existingDebts) }}</td>
                <td class="negative">{{ fmt(m.existingCardPurchases) }}</td>
                <td :class="m.simulatedInstallment > 0 ? 'simulated' : 'zero'">
                  {{ m.simulatedInstallment > 0 ? fmt(m.simulatedInstallment) : '—' }}
                </td>
                <td class="negative">{{ fmt(m.totalExpenses) }}</td>
                <td :class="balanceClass(m.balance)"><strong>{{ fmt(m.balance) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Disclaimer -->
      <div class="disclaimer">
        ⚠️ Esta é apenas uma simulação. Nenhum dado foi salvo ou alterado.
      </div>
    </div>
  </div>
</template>

<style scoped>
.simulation-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-heading, #1a1a2e);
  margin: 0;
}

.page-subtitle {
  color: var(--color-text-secondary, #6b7280);
  margin-top: 0.25rem;
  font-size: 0.95rem;
}

/* Form Sections */
.form-section {
  background: var(--color-background-soft, #f8f9fa);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-section h2 {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--color-heading, #1a1a2e);
}

.section-hint {
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.85rem;
  margin: -0.5rem 0 1rem;
}

/* Items */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 0.9rem;
  background: var(--color-background, #fff);
  color: var(--color-text, #1a1a2e);
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.description-input {
  flex: 1;
  min-width: 180px;
}

.qty-input {
  width: 70px;
  text-align: center;
}

.price-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0;
}

.price-prefix {
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  background: var(--color-background-mute, #eee);
  border: 1px solid var(--color-border, #d1d5db);
  border-right: 0;
  border-radius: 8px 0 0 8px;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #6b7280);
}

.price-input {
  width: 110px;
  border-radius: 0 8px 8px 0;
}

.item-subtotal {
  font-weight: 600;
  color: var(--color-text, #1a1a2e);
  min-width: 100px;
  text-align: right;
  font-size: 0.9rem;
}

.btn-remove {
  background: none;
  border: none;
  color: var(--color-danger, #ef4444);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-remove:hover {
  background: rgba(239, 68, 68, 0.1);
}

.items-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-add {
  background: none;
  border: 1px dashed var(--color-border, #d1d5db);
  color: var(--color-primary, #6366f1);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-add:hover {
  border-color: var(--color-primary, #6366f1);
  background: rgba(99, 102, 241, 0.05);
}

.total-badge {
  background: var(--color-primary, #6366f1);
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  font-size: 0.95rem;
}

/* Cards Overview */
.cards-overview-section h2 {
  margin-bottom: 1rem;
}

.cards-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.card-limit-box {
  background: var(--color-background, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  padding: 1rem;
}

.card-limit-box.limit-ok {
  border-color: rgba(16, 185, 129, 0.3);
}

.card-limit-box.limit-low {
  border-color: rgba(239, 68, 68, 0.3);
}

.card-limit-name {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  color: var(--color-heading, #1a1a2e);
}

.card-digits {
  font-weight: 400;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.85rem;
}

.card-limit-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 0.2rem 0;
}

.card-limit-label {
  color: var(--color-text-secondary, #6b7280);
}

.available-row {
  padding-top: 0.4rem;
  margin-top: 0.25rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
  font-weight: 600;
}

/* Plans */
.plans-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.plan-card {
  background: var(--color-background, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  padding: 1rem;
}

.plan-header-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.plan-label-input {
  font-weight: 600;
  min-width: 150px;
  flex: 0 0 auto;
}

.plan-allocated-info {
  flex: 1;
  text-align: right;
  font-size: 0.85rem;
}

.remaining-warn {
  color: var(--color-warning, #f59e0b);
  font-weight: 600;
}

.remaining-over {
  color: var(--color-danger, #ef4444);
  font-weight: 600;
}

.remaining-ok {
  color: var(--color-success, #10b981);
  font-weight: 600;
}

.alloc-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.alloc-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.select-card {
  flex: 1;
  min-width: 200px;
}

.alloc-amount-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.btn-fill {
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-primary, #6366f1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-fill:hover {
  background: rgba(99, 102, 241, 0.2);
}

.installments-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.installments-input {
  width: 65px;
  text-align: center;
}

.installments-label {
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
}

.installment-preview {
  color: var(--color-primary, #6366f1);
  font-weight: 600;
  font-size: 0.85rem;
  white-space: nowrap;
}

.btn-add-alloc {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
}

/* Inline Section */
.inline-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.projection-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.projection-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: var(--color-text, #1a1a2e);
}

.projection-select {
  width: auto;
}

.btn-simulate {
  background: var(--color-primary, #6366f1);
  color: #fff;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-simulate:hover:not(:disabled) {
  background: var(--color-primary-hover, #4f46e5);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-simulate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Results */
.results-section {
  margin-top: 2rem;
}

.results-section h2 {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-heading, #1a1a2e);
}

.results-section h3 {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
  color: var(--color-heading, #1a1a2e);
}

.result-items {
  background: var(--color-background-soft, #f8f9fa);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.result-item-row {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
  font-size: 0.9rem;
}

.result-item-row + .result-item-row {
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.total-row {
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 2px solid var(--color-border, #d1d5db) !important;
  font-size: 1rem;
}

/* Plan Tabs */
.plan-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.plan-tab {
  padding: 0.6rem 1.25rem;
  border: 2px solid var(--color-border, #d1d5db);
  border-radius: 10px;
  background: var(--color-background, #fff);
  color: var(--color-text, #1a1a2e);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.plan-tab.active {
  border-color: var(--color-primary, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-primary, #6366f1);
  font-weight: 600;
}

.plan-tab.has-issues {
  border-color: rgba(239, 68, 68, 0.4);
}

.tab-warn {
  font-size: 0.85rem;
}

/* Allocation Results */
.alloc-results {
  margin-bottom: 0.5rem;
}

.alloc-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.alloc-result-card {
  background: var(--color-background-soft, #f8f9fa);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  padding: 1rem;
}

.alloc-result-card.exceeds {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.03);
}

.alloc-card-name {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  color: var(--color-heading, #1a1a2e);
}

.alloc-card-stats {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.alloc-stat {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.alloc-stat-label {
  color: var(--color-text-secondary, #6b7280);
}

.alloc-stat-value {
  font-weight: 600;
}

.alloc-warning {
  margin-top: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--color-danger, #ef4444);
}

/* Plan Summary Badges */
.plan-summary-badges {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.summary-badge {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
}

.badge-ok {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success, #10b981);
}

.badge-warn {
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning, #f59e0b);
}

.badge-error {
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-danger, #ef4444);
}

/* Table */
.table-wrapper {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--color-border, #e5e7eb);
}

.projection-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.projection-table th {
  background: var(--color-background-mute, #f3f4f6);
  padding: 0.75rem 0.6rem;
  text-align: right;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.8rem;
  white-space: nowrap;
}

.projection-table th:first-child {
  text-align: left;
}

.projection-table td {
  padding: 0.6rem;
  text-align: right;
  border-top: 1px solid var(--color-border, #f0f0f0);
}

.projection-table td:first-child {
  text-align: left;
}

.month-cell {
  font-weight: 600;
  color: var(--color-heading, #1a1a2e);
  white-space: nowrap;
}

.has-simulation {
  background: rgba(99, 102, 241, 0.04);
}

.positive {
  color: var(--color-success, #10b981);
}

.negative {
  color: var(--color-danger, #ef4444);
}

.tight {
  color: var(--color-warning, #f59e0b);
}

.simulated {
  color: var(--color-primary, #6366f1);
  font-weight: 700;
}

.zero {
  color: var(--color-text-secondary, #9ca3af);
}

/* Disclaimer */
.disclaimer {
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  color: var(--color-warning, #f59e0b);
  font-size: 0.85rem;
  text-align: center;
}

/* Mobile */
@media (max-width: 768px) {
  .simulation-container {
    padding: 1rem;
  }

  .item-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-background, #fff);
    border-radius: 8px;
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .item-subtotal {
    text-align: left;
  }

  .alloc-row {
    flex-direction: column;
    align-items: stretch;
  }

  .plan-header-row {
    flex-direction: column;
    align-items: stretch;
  }

  .plan-allocated-info {
    text-align: left;
  }

  .inline-section {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-simulate {
    width: 100%;
    justify-content: center;
  }

  .cards-overview-grid {
    grid-template-columns: 1fr;
  }

  .alloc-result-grid {
    grid-template-columns: 1fr;
  }

  .plan-tabs {
    flex-direction: column;
  }
}
</style>
