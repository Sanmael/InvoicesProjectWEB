<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { useFinancialSummaryStore } from '@/stores/financialSummary'
import { useDebtStore } from '@/stores/debt'
import { useReceivableStore } from '@/stores/receivable'
import { useCreditCardStore } from '@/stores/creditCard'
import { financialSummaryService } from '@/services/financialSummaryService'
import type { Debt, Receivable, CreditCard, FinancialScore } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const summaryStore = useFinancialSummaryStore()
const debtStore = useDebtStore()
const receivableStore = useReceivableStore()
const cardStore = useCreditCardStore()
const selectedMonth = ref(new Date().toISOString().slice(0, 7))

// Projection range
const projectionMonths = ref<6 | 12>(12)

// Financial Score
const financialScore = ref<FinancialScore | null>(null)
const scoreLoading = ref(false)

type DashboardDebtItem =
  | { kind: 'single'; debt: Debt }
  | { kind: 'group'; groupId: string; debts: Debt[]; representative: Debt }

type DashboardReceivableItem =
  | { kind: 'single'; receivable: Receivable }
  | { kind: 'group'; groupId: string; receivables: Receivable[]; representative: Receivable }

onMounted(async () => {
  const parts = selectedMonth.value.split('-')
  const parsedYear = Number(parts[0])
  const parsedMonth = Number(parts[1])
  const now = new Date()
  const year = Number.isFinite(parsedYear) ? parsedYear : now.getFullYear()
  const month = Number.isFinite(parsedMonth) ? parsedMonth : now.getMonth() + 1
  await Promise.all([
    summaryStore.fetchByMonth(year, month),
    debtStore.fetchAll(),
    receivableStore.fetchAll(),
    cardStore.fetchAll(),
  ])

  // Load financial score in background
  scoreLoading.value = true
  try {
    financialScore.value = await financialSummaryService.getFinancialScore()
  } catch { /* silent */ }
  scoreLoading.value = false
})

watch(selectedMonth, async (value) => {
  showAllDebts.value = false
  showAllReceivables.value = false
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return
  await summaryStore.fetchByMonth(year, month)
})

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
const formatCivilDate = (dateStr: string) => {
  const { year, month, day } = parseCivilDate(dateStr)
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

const balanceClass = computed(() => {
  if (!summaryStore.summary) return ''
  return summaryStore.summary.balance >= 0 ? 'positive' : 'negative'
})

const monthName = computed(() => {
  if (!summaryStore.summary) return ''
  const date = new Date(summaryStore.summary.year, summaryStore.summary.month - 1)
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
})

// ========== Cash Flow Projection ==========

interface MonthProjection {
  label: string
  year: number
  month: number
  income: number
  expenses: number
  cardExpenses: number
  balance: number
  cumulativeBalance: number
}

const cashFlowProjection = computed<MonthProjection[]>(() => {
  const now = new Date()
  const months: MonthProjection[] = []
  let cumulative = 0

  for (let i = 0; i < projectionMonths.value; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = date.getFullYear()
    const m = date.getMonth() + 1

    // Sum receivables for this month
    const income = receivableStore.receivables
      .filter((r) => !r.isReceived || i === 0)
      .filter((r) => {
        const d = parseCivilDate(r.expectedDate)
        return d.year === y && d.month === m
      })
      .reduce((sum, r) => sum + r.amount, 0)

    // Sum debts for this month
    const expenses = debtStore.debts
      .filter((d) => !d.isPaid || i === 0)
      .filter((d) => {
        const dd = parseCivilDate(d.dueDate)
        return dd.year === y && dd.month === m
      })
      .reduce((sum, d) => sum + d.amount, 0)

    // Sum card purchases for this month (using totalPending per card spread by closing day)
    const cardExpenses = cardStore.cards.reduce((sum, card) => {
      return sum + (card.totalPending / Math.max(projectionMonths.value / 2, 1))
    }, 0)

    // Only count card expenses for months where there are active cards
    const actualCardExpenses = i < 6 ? cardExpenses : 0

    const balance = income - expenses - actualCardExpenses
    cumulative += balance

    const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

    months.push({
      label: monthLabel,
      year: y,
      month: m,
      income,
      expenses,
      cardExpenses: actualCardExpenses,
      balance,
      cumulativeBalance: cumulative,
    })
  }

  return months
})

const chartData = computed(() => {
  const data = cashFlowProjection.value
  const balances = data.map((d) => d.cumulativeBalance)

  return {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: 'Saldo Projetado',
        data: balances,
        borderColor: '#818cf8',
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart
          const { ctx: canvasCtx, chartArea } = chart
          if (!chartArea) return 'rgba(129, 140, 248, 0.1)'
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(129, 140, 248, 0.3)')
          gradient.addColorStop(1, 'rgba(129, 140, 248, 0.02)')
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: balances.map((v) => (v >= 0 ? '#818cf8' : '#f87171')),
        pointBorderColor: balances.map((v) => (v >= 0 ? '#818cf8' : '#f87171')),
        segment: {
          borderColor: (ctx: any) => {
            const currentVal = ctx.p0.parsed.y
            const nextVal = ctx.p1.parsed.y
            return currentVal < 0 || nextVal < 0 ? '#f87171' : '#818cf8'
          },
        },
      },
      {
        label: 'Receitas',
        data: data.map((d) => d.income),
        borderColor: '#34d399',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: 'Despesas',
        data: data.map((d) => d.expenses + d.cardExpenses),
        borderColor: '#f87171',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: 'rgb(148, 163, 184)',
        usePointStyle: true,
        padding: 20,
        font: { size: 12 },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#f1f5f9',
      bodyColor: '#cbd5e1',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 12,
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(51, 65, 85, 0.3)' },
      ticks: { color: 'rgb(148, 163, 184)', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(51, 65, 85, 0.3)' },
      ticks: {
        color: 'rgb(148, 163, 184)',
        font: { size: 11 },
        callback: (value: any) => formatCurrency(value),
      },
    },
  },
}))

// ========== AI Insights ==========

const aiInsights = computed(() => {
  const insights: { icon: string; type: 'warning' | 'danger' | 'success' | 'info'; text: string }[] = []
  const proj = cashFlowProjection.value

  // Check for negative balance months
  const negativeMonths = proj.filter((m) => m.cumulativeBalance < 0)
  if (negativeMonths.length > 0) {
    const first = negativeMonths[0]!
    insights.push({
      icon: '⚠️',
      type: 'danger',
      text: `Atenção! Seu saldo ficará negativo em ${first.label} (${formatCurrency(first.cumulativeBalance)}). Considere adiar alguma despesa ou buscar receita extra.`,
    })
  }

  // High expense months
  const avgExpense = proj.reduce((s, m) => s + m.expenses, 0) / proj.length
  const highExpenseMonths = proj.filter((m) => m.expenses > avgExpense * 1.5 && m.expenses > 0)
  if (highExpenseMonths.length > 0) {
    const m = highExpenseMonths[0]!
    insights.push({
      icon: '📊',
      type: 'warning',
      text: `${m.label} terá despesas ${Math.round((m.expenses / avgExpense - 1) * 100)}% acima da média (${formatCurrency(m.expenses)}).`,
    })
  }

  // Months with no income
  const noIncomeMonths = proj.slice(0, 6).filter((m) => m.income === 0)
  if (noIncomeMonths.length > 2) {
    insights.push({
      icon: '💡',
      type: 'info',
      text: `Você tem ${noIncomeMonths.length} meses sem receitas previstas nos próximos 6 meses. Cadastre suas receitas recorrentes para uma projeção mais precisa.`,
    })
  }

  // Good balance
  const allPositive = proj.every((m) => m.cumulativeBalance >= 0)
  if (allPositive && proj.length > 0) {
    insights.push({
      icon: '✅',
      type: 'success',
      text: `Ótima notícia! Seu saldo se mantém positivo nos próximos ${projectionMonths.value} meses. Continue assim!`,
    })
  }

  // Card expenses info
  const totalCardPending = cardStore.cards.reduce((s, c) => s + c.totalPending, 0)
  if (totalCardPending > 0) {
    insights.push({
      icon: '💳',
      type: 'info',
      text: `Você tem ${formatCurrency(totalCardPending)} em compras pendentes nos cartões.`,
    })
  }

  // If no insights, give a default
  if (insights.length === 0) {
    insights.push({
      icon: '🤖',
      type: 'info',
      text: 'Cadastre mais despesas e receitas para que eu possa gerar projeções mais precisas.',
    })
  }

  return insights
})

// ========== Pending Items (existing logic) ==========

const groupedPendingDebts = computed<DashboardDebtItem[]>(() => {
  const seen = new Set<string>()
  const result: DashboardDebtItem[] = []
  const pendingDebts = debtStore.debts.filter((d) => !d.isPaid)

  for (const debt of pendingDebts) {
    if (!debt.isInstallment && debt.installmentGroupId) {
      const groupId = debt.installmentGroupId
      if (seen.has(groupId)) continue

      const debts = pendingDebts
        .filter((d) => !d.isInstallment && d.installmentGroupId === groupId)
        .sort((a, b) => parseCivilDate(a.dueDate).sortKey - parseCivilDate(b.dueDate).sortKey)

      if (debts.length === 0) continue
      result.push({ kind: 'group', groupId, debts, representative: debts[0] as Debt })
      seen.add(groupId)
      continue
    }

    result.push({ kind: 'single', debt })
  }

  return result
})

const groupedPendingReceivables = computed<DashboardReceivableItem[]>(() => {
  const seen = new Set<string>()
  const result: DashboardReceivableItem[] = []
  const pendingReceivables = receivableStore.receivables.filter((r) => !r.isReceived)

  for (const receivable of pendingReceivables) {
    if (receivable.isRecurring && receivable.recurrenceGroupId) {
      const groupId = receivable.recurrenceGroupId
      if (seen.has(groupId)) continue

      const receivables = pendingReceivables
        .filter((r) => r.isRecurring && r.recurrenceGroupId === groupId)
        .sort((a, b) => parseCivilDate(a.expectedDate).sortKey - parseCivilDate(b.expectedDate).sortKey)

      if (receivables.length === 0) continue
      result.push({ kind: 'group', groupId, receivables, representative: receivables[0] as Receivable })
      seen.add(groupId)
      continue
    }

    result.push({ kind: 'single', receivable })
  }

  return result
})

const showAllDebts = ref(false)
const showAllReceivables = ref(false)

const filteredPendingDebts = computed<DashboardDebtItem[]>(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  if (!year || !month) return groupedPendingDebts.value
  return groupedPendingDebts.value.filter((item) => {
    if (item.kind === 'single') {
      const d = parseCivilDate(item.debt.dueDate)
      return d.year === year && d.month === month
    }
    return item.debts.some((d) => {
      const date = parseCivilDate(d.dueDate)
      return date.year === year && date.month === month
    })
  })
})

const filteredPendingReceivables = computed<DashboardReceivableItem[]>(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  if (!year || !month) return groupedPendingReceivables.value
  return groupedPendingReceivables.value.filter((item) => {
    if (item.kind === 'single') {
      const d = parseCivilDate(item.receivable.expectedDate)
      return d.year === year && d.month === month
    }
    return item.receivables.some((r) => {
      const date = parseCivilDate(r.expectedDate)
      return date.year === year && date.month === month
    })
  })
})

const displayedDebts = computed(() => {
  if (showAllDebts.value) return filteredPendingDebts.value
  return filteredPendingDebts.value.slice(0, 5)
})

const displayedReceivables = computed(() => {
  if (showAllReceivables.value) return filteredPendingReceivables.value
  return filteredPendingReceivables.value.slice(0, 5)
})
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div>
        <h1>Dashboard</h1>
        <p class="current-month">{{ monthName }}</p>
      </div>
      <div class="month-picker">
        <label for="month-select">Filtrar por mês</label>
        <input id="month-select" v-model="selectedMonth" type="month" />
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="summaryStore.loading" class="loading">
      Carregando...
    </div>

    <!-- Error state -->
    <div v-else-if="summaryStore.error" class="error-alert">
      {{ summaryStore.error }}
    </div>

    <template v-else-if="summaryStore.summary">
      <!-- Summary Cards -->
      <div class="summary-grid">
        <div class="summary-card balance" :class="balanceClass">
          <div class="card-icon">💰</div>
          <div class="card-content">
            <h3>Saldo do Mês</h3>
            <p class="amount">{{ formatCurrency(summaryStore.summary.balance) }}</p>
          </div>
        </div>

        <div class="summary-card receivables">
          <div class="card-icon">📈</div>
          <div class="card-content">
            <h3>Receitas</h3>
            <p class="amount">{{ formatCurrency(summaryStore.summary.totalReceivables) }}</p>
          </div>
        </div>

        <div class="summary-card debts">
          <div class="card-icon">📉</div>
          <div class="card-content">
            <h3>Despesas</h3>
            <p class="amount">{{ formatCurrency(summaryStore.summary.totalDebts) }}</p>
          </div>
        </div>

        <div class="summary-card cards">
          <div class="card-icon">💳</div>
          <div class="card-content">
            <h3>Cartões</h3>
            <p class="amount">{{ formatCurrency(summaryStore.summary.totalCardPurchases) }}</p>
          </div>
        </div>
      </div>

      <!-- Financial Health Score -->
      <div v-if="financialScore" class="score-section">
        <div class="score-header">
          <h2>🏆 Saúde Financeira</h2>
          <span class="score-classification" :class="'score-' + financialScore.classification.toLowerCase()">
            {{ financialScore.classification }}
          </span>
        </div>
        <div class="score-body">
          <div class="score-gauge">
            <svg viewBox="0 0 120 120" class="score-ring">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" stroke-width="10" />
              <circle cx="60" cy="60" r="52" fill="none"
                :stroke="financialScore.totalScore >= 70 ? 'var(--color-success)' : financialScore.totalScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'"
                stroke-width="10" stroke-linecap="round"
                :stroke-dasharray="(financialScore.totalScore / 100 * 326.7) + ' 326.7'"
                transform="rotate(-90 60 60)" />
            </svg>
            <span class="score-number">{{ financialScore.totalScore }}</span>
          </div>
          <div class="score-breakdown">
            <div class="score-bar-item" v-for="item in [
              { label: 'Disciplina de Pagamento', value: financialScore.breakdown.paymentDiscipline, max: financialScore.breakdown.paymentDisciplineMax },
              { label: 'Utilização de Crédito', value: financialScore.breakdown.creditUtilization, max: financialScore.breakdown.creditUtilizationMax },
              { label: 'Taxa de Poupança', value: financialScore.breakdown.savingsRate, max: financialScore.breakdown.savingsRateMax },
              { label: 'Progresso de Metas', value: financialScore.breakdown.goalProgress, max: financialScore.breakdown.goalProgressMax },
              { label: 'Organização', value: financialScore.breakdown.financialOrganization, max: financialScore.breakdown.financialOrganizationMax },
            ]" :key="item.label">
              <div class="bar-label">
                <span>{{ item.label }}</span>
                <span class="bar-value">{{ item.value }}/{{ item.max }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (item.value / item.max * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="financialScore.tips.length > 0" class="score-tips">
          <div v-for="(tip, i) in financialScore.tips" :key="i" class="score-tip">
            💡 {{ tip }}
          </div>
        </div>
      </div>
      <div v-else-if="scoreLoading" class="score-section score-loading">
        <p>Calculando score financeiro...</p>
      </div>

      <!-- Cash Flow Chart -->
      <div class="chart-section">
        <div class="chart-header">
          <h2>📊 Fluxo de Caixa Projetado</h2>
          <div class="chart-controls">
            <button
              :class="['chart-range-btn', { active: projectionMonths === 6 }]"
              @click="projectionMonths = 6"
            >6 meses</button>
            <button
              :class="['chart-range-btn', { active: projectionMonths === 12 }]"
              @click="projectionMonths = 12"
            >12 meses</button>
          </div>
        </div>
        <div class="chart-container">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Insights + Pending Items -->
      <div class="bottom-grid">
        <!-- AI Insights -->
        <div class="insights-card">
          <h2>🤖 Insights da Kash</h2>
          <div class="insights-list">
            <div
              v-for="(insight, idx) in aiInsights"
              :key="idx"
              class="insight-item"
              :class="'insight-' + insight.type"
            >
              <span class="insight-icon">{{ insight.icon }}</span>
              <p>{{ insight.text }}</p>
            </div>
          </div>
        </div>

        <!-- Pending Debts -->
        <div class="recent-card">
          <h2>📉 Despesas Pendentes</h2>
          <div v-if="debtStore.loading" class="loading-small">Carregando...</div>
          <ul v-else-if="filteredPendingDebts.length > 0" class="item-list">
            <li
              v-for="item in displayedDebts"
              :key="item.kind === 'group' ? `group-${item.groupId}` : item.debt.id"
              class="item"
            >
              <div class="item-info">
                <span class="item-description">
                  {{ item.kind === 'group' ? item.representative.description : item.debt.description }}
                  <span v-if="item.kind === 'group'" class="item-badge">Recorrente ({{ item.debts.length }})</span>
                </span>
                <span class="item-date">
                  {{ formatCivilDate(item.kind === 'group' ? item.representative.dueDate : item.debt.dueDate) }}
                </span>
              </div>
              <span class="item-amount negative">
                {{ formatCurrency(item.kind === 'group' ? item.representative.amount : item.debt.amount) }}
              </span>
            </li>
          </ul>
          <p v-else class="empty-message">Nenhuma despesa pendente neste mês 🎉</p>
          <button v-if="filteredPendingDebts.length > 5" class="view-all-btn" @click="showAllDebts = !showAllDebts">
            {{ showAllDebts ? 'Ver menos ↑' : `Ver todos (${filteredPendingDebts.length}) ↓` }}
          </button>
        </div>

        <!-- Pending Receivables -->
        <div class="recent-card">
          <h2>📈 Receitas Pendentes</h2>
          <div v-if="receivableStore.loading" class="loading-small">Carregando...</div>
          <ul v-else-if="filteredPendingReceivables.length > 0" class="item-list">
            <li
              v-for="item in displayedReceivables"
              :key="item.kind === 'group' ? `group-${item.groupId}` : item.receivable.id"
              class="item"
            >
              <div class="item-info">
                <span class="item-description">
                  {{ item.kind === 'group' ? item.representative.description : item.receivable.description }}
                  <span v-if="item.kind === 'group'" class="item-badge">Recorrente ({{ item.receivables.length }})</span>
                </span>
                <span class="item-date">
                  {{ formatCivilDate(item.kind === 'group' ? item.representative.expectedDate : item.receivable.expectedDate) }}
                </span>
              </div>
              <span class="item-amount positive">
                {{ formatCurrency(item.kind === 'group' ? item.representative.amount : item.receivable.amount) }}
              </span>
            </li>
          </ul>
          <p v-else class="empty-message">Nenhuma receita pendente neste mês</p>
          <button v-if="filteredPendingReceivables.length > 5" class="view-all-btn" @click="showAllReceivables = !showAllReceivables">
            {{ showAllReceivables ? 'Ver menos ↑' : `Ver todos (${filteredPendingReceivables.length}) ↓` }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 2rem;
}

.month-picker {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.month-picker label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.month-picker input {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--input-border);
  border-radius: var(--border-radius);
  background: var(--input-bg);
  color: var(--text-primary);
}

.dashboard-header h1 {
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.current-month {
  color: var(--text-secondary);
  text-transform: capitalize;
  margin: 0;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

/* ===== Summary Cards ===== */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}

.summary-card.balance.positive {
  background: linear-gradient(135deg, var(--color-success-bg) 0%, var(--color-success-bg) 100%);
}

.summary-card.balance.negative {
  background: linear-gradient(135deg, var(--color-danger-bg) 0%, var(--color-danger-bg) 100%);
}

.card-icon { font-size: 2.2rem; }

.card-content h3 {
  margin: 0 0 0.2rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.card-content .amount {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* ===== Chart Section ===== */
.chart-section {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-sm);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.chart-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.chart-controls {
  display: flex;
  gap: 0.5rem;
}

.chart-range-btn {
  padding: 0.4rem 1rem;
  border: 1px solid var(--input-border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chart-range-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.chart-range-btn:hover:not(.active) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.chart-container {
  height: 320px;
  position: relative;
}

/* ===== Bottom Grid ===== */
.bottom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* ===== Insights Card ===== */
.insights-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.insights-card h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem;
  border-radius: var(--border-radius-lg);
  border-left: 3px solid transparent;
}

.insight-item p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-primary);
}

.insight-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.insight-danger {
  background: var(--color-danger-bg);
  border-left-color: var(--color-danger);
}

.insight-warning {
  background: var(--color-warning-bg);
  border-left-color: var(--color-warning);
}

.insight-success {
  background: var(--color-success-bg);
  border-left-color: var(--color-success);
}

.insight-info {
  background: var(--color-info-bg);
  border-left-color: var(--color-info);
}

/* ===== Recent Cards ===== */
.recent-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: background-color 0.3s ease;
}

.recent-card h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}

.item:last-child {
  border-bottom: none;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-description {
  font-weight: 500;
  color: var(--text-primary);
}

.item-badge {
  margin-left: 0.5rem;
  font-size: 0.72rem;
  background: var(--color-info-bg);
  color: var(--color-info);
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
  font-weight: 600;
}

.item-date {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.item-amount { font-weight: 600; }
.item-amount.positive { color: var(--color-success); }
.item-amount.negative { color: var(--color-danger); }

.empty-message {
  color: var(--text-muted);
  text-align: center;
  padding: 1rem 0;
}

.view-all-btn {
  display: block;
  width: 100%;
  text-align: center;
  margin-top: 1rem;
  padding: 0.5rem;
  background: none;
  border: 1px solid var(--input-border);
  border-radius: var(--border-radius);
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-all-btn:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.loading-small {
  color: var(--text-muted);
  padding: 1rem 0;
}

/* ===== Financial Score ===== */
.score-section {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-sm);
}
.score-loading { text-align: center; color: var(--text-muted); }
.score-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.score-header h2 { margin: 0; font-size: 1.1rem; color: var(--text-primary); }
.score-classification {
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
}
.score-excelente { background: var(--color-success-bg); color: var(--color-success); }
.score-bom { background: var(--color-primary-light); color: var(--color-primary); }
.score-regular { background: var(--color-warning-bg); color: var(--color-warning); }
.score-atenção { background: var(--color-danger-bg); color: var(--color-danger); }
.score-crítico { background: var(--color-danger-bg); color: var(--color-danger); }

.score-body {
  display: flex;
  gap: 2rem;
  align-items: center;
}
.score-gauge {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}
.score-ring { width: 100%; height: 100%; }
.score-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
}
.score-breakdown { flex: 1; display: flex; flex-direction: column; gap: 0.6rem; }
.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.2rem;
}
.bar-value { font-weight: 600; color: var(--text-primary); }
.bar-track {
  height: 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.4s ease;
}
.score-tips {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.score-tip {
  font-size: 0.85rem;
  padding: 0.6rem 0.8rem;
  background: var(--color-info-bg);
  border-radius: var(--border-radius);
  color: var(--text-primary);
  border-left: 3px solid var(--color-info);
}

/* ===== Responsivo ===== */
@media (max-width: 640px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr 1fr;
  }

  .bottom-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 250px;
  }

  .summary-card {
    padding: 1rem;
  }

  .card-content .amount {
    font-size: 1.1rem;
  }
}
</style>
