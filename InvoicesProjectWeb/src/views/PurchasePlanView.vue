<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePurchasePlan } from '@/composables/usePurchasePlan'
import type { PurchaseScenario } from '@/types'

const router = useRouter()
const { plan } = usePurchasePlan()

if (!plan.value) {
  router.replace('/chat')
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function balanceClass(value: number) {
  if (value < 0) return 'negative'
  if (value < 500) return 'tight'
  return 'positive'
}

function scenarioIcon(s: PurchaseScenario) {
  if (s.type === 'pix') return '💸'
  if (s.installments === 1) return '💳'
  return '📅'
}

const viableScenarios = computed(() => plan.value?.scenarios.filter(s => s.viable) ?? [])
const notViableScenarios = computed(() => plan.value?.scenarios.filter(s => !s.viable) ?? [])

const selectedScenario = computed(() => {
  return viableScenarios.value[0] ?? plan.value?.scenarios[0]
})
</script>

<template>
  <div v-if="plan" class="plan-container">
    <header class="plan-header">
      <button class="back-btn" @click="router.push('/chat')">← Voltar ao Chat</button>
      <h1>📊 Plano de Compra</h1>
      <p class="plan-subtitle">{{ plan.product }}</p>
    </header>

    <!-- Summary Cards -->
    <div class="summary-cards">
      <div class="summary-card">
        <span class="card-label">Preço total</span>
        <span class="card-value">{{ fmt(plan.totalPrice) }}</span>
      </div>
      <div class="summary-card pix">
        <span class="card-label">PIX ({{ plan.pixDiscountPercent }}% desc.)</span>
        <span class="card-value">{{ fmt(plan.pixPrice) }}</span>
        <span class="card-savings">Economia: {{ fmt(plan.totalPrice - plan.pixPrice) }}</span>
      </div>
      <div v-if="plan.savingsGoal > 0" class="summary-card">
        <span class="card-label">Meta mensal</span>
        <span class="card-value">{{ fmt(plan.savingsGoal) }}</span>
      </div>
    </div>

    <!-- Monthly Projection -->
    <section class="section">
      <h2>📅 Projeção Mensal</h2>
      <div class="table-wrapper">
        <table class="projection-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receitas</th>
              <th>Débitos</th>
              <th>Cartões</th>
              <th>Total Saídas</th>
              <th>Saldo Livre</th>
              <th v-if="plan.savingsGoal > 0">Após Meta</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in plan.monthlyProjection" :key="m.month"
                :class="{ 'empty-month': m.receivables === 0 && m.debts === 0 && m.cards === 0 }">
              <td class="month-cell">{{ m.label }}</td>
              <td class="positive">{{ fmt(m.receivables) }}</td>
              <td class="negative">{{ fmt(m.debts) }}</td>
              <td class="negative">{{ fmt(m.cards) }}</td>
              <td>{{ fmt(m.totalExpenses) }}</td>
              <td :class="balanceClass(m.freeBalance)">{{ fmt(m.freeBalance) }}</td>
              <td v-if="plan.savingsGoal > 0" :class="balanceClass(m.afterSavings)">{{ fmt(m.afterSavings) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Recommendation -->
    <section class="section recommendation-section">
      <h2>💡 Recomendação</h2>
      <div class="recommendation-box">
        <p>{{ plan.recommendation }}</p>
      </div>
    </section>

    <!-- Card Strategy -->
    <section v-if="plan.cardStrategy && plan.cardStrategy.cards.length > 0" class="section">
      <h2>💳 Estratégia de Cartões</h2>

      <!-- Cards Overview -->
      <div class="card-overview">
        <div class="card-overview-header">
          <span class="card-overview-label">Limite total disponível</span>
          <span class="card-overview-value" :class="plan.cardStrategy.coversFullAmount ? 'positive' : 'negative'">
            {{ fmt(plan.cardStrategy.totalAvailable) }}
            <span v-if="plan.cardStrategy.coversFullAmount" class="covers-badge">Cobre o valor</span>
            <span v-else class="no-covers-badge">Não cobre</span>
          </span>
        </div>
      </div>

      <!-- Individual Cards -->
      <div class="cards-list">
        <div v-for="card in plan.cardStrategy.cards" :key="card.cardId" class="strategy-card-item"
             :class="{ 'best-card': card.cardName === plan.cardStrategy.bestCardName }">
          <div class="strategy-card-row">
            <div class="strategy-card-name">
              <span class="strategy-card-icon">💳</span>
              {{ card.cardName }}
              <span class="card-digits">•••• {{ card.lastFourDigits }}</span>
              <span v-if="card.cardName === plan.cardStrategy.bestCardName" class="best-badge">MELHOR</span>
            </div>
            <div class="strategy-card-info">
              <span class="info-item">
                <span class="info-label">Disponível:</span>
                <span class="info-value" :class="card.availableLimit >= plan.totalPrice ? 'positive' : ''">
                  {{ fmt(card.availableLimit) }}
                </span>
              </span>
              <span class="info-item">
                <span class="info-label">Fecha dia:</span>
                <span class="info-value">{{ card.closingDay }}</span>
              </span>
              <span class="info-item">
                <span class="info-label">Vence dia:</span>
                <span class="info-value">{{ card.dueDay }}</span>
              </span>
              <span class="info-item">
                <span class="info-label">Prazo:</span>
                <span class="info-value days-value" :class="card.daysUntilPayment >= 30 ? 'positive' : 'tight'">
                  {{ card.daysUntilPayment }}d
                </span>
              </span>
              <span v-if="card.afterClosing" class="closing-badge">Pós-fechamento</span>
              <span v-else class="closing-badge open">Fatura aberta</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Strategies -->
      <div v-if="plan.cardStrategy.strategies.length > 0" class="strategies-section">
        <h3>🎯 Sugestões de uso</h3>
        <div class="strategies-grid">
          <div v-for="(strat, idx) in plan.cardStrategy.strategies" :key="idx"
               class="strategy-option" :class="{ recommended: idx === 0 }">
            <div class="strategy-option-header">
              <span class="strategy-option-label">{{ strat.label }}</span>
              <span v-if="idx === 0" class="best-badge">RECOMENDADO</span>
              <span v-if="!strat.coversFullAmount" class="no-covers-badge">Parcial</span>
            </div>
            <div class="strategy-allocations">
              <div v-for="alloc in strat.allocations" :key="alloc.cardId" class="allocation-row">
                <div class="allocation-card">
                  <strong>{{ alloc.cardName }}</strong>
                  <span class="card-digits">•••• {{ alloc.lastFourDigits }}</span>
                </div>
                <div class="allocation-amount">{{ fmt(alloc.amount) }}</div>
                <div class="allocation-detail">{{ alloc.explanation }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No strategy available -->
      <div v-else class="no-strategy-box">
        <p>⚠️ Nenhum cartão tem limite suficiente para esta compra. Considere o PIX ou aguarde a liberação de limite.</p>
      </div>
    </section>

    <!-- Viable Scenarios -->
    <section v-if="viableScenarios.length > 0" class="section">
      <h2>✅ Cenários Viáveis</h2>
      <div class="scenarios-grid">
        <div v-for="s in viableScenarios" :key="s.label" class="scenario-card viable"
             :class="{ best: s === selectedScenario }">
          <div class="scenario-header">
            <span class="scenario-icon">{{ scenarioIcon(s) }}</span>
            <span class="scenario-label">{{ s.label }}</span>
            <span v-if="s === selectedScenario" class="best-badge">MELHOR</span>
          </div>
          <div class="scenario-body">
            <div class="scenario-stat">
              <span class="stat-label">Custo total</span>
              <span class="stat-value">{{ fmt(s.totalCost) }}</span>
            </div>
            <div class="scenario-stat">
              <span class="stat-label">Parcela</span>
              <span class="stat-value">{{ s.installments }}x de {{ fmt(s.installmentValue) }}</span>
            </div>
          </div>
          <div class="scenario-impact">
            <div v-for="m in s.monthlyImpact" :key="m.month" class="impact-row">
              <span class="impact-month">{{ m.label }}</span>
              <span class="impact-payment">-{{ fmt(m.payment) }}</span>
              <span class="impact-remaining" :class="balanceClass(m.remainingAfterSavings)">
                sobra {{ fmt(m.remainingAfterSavings) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Not Viable Scenarios -->
    <section v-if="notViableScenarios.length > 0" class="section">
      <h2>⚠️ Cenários que Comprometem a Meta</h2>
      <div class="scenarios-grid">
        <div v-for="s in notViableScenarios" :key="s.label" class="scenario-card not-viable">
          <div class="scenario-header">
            <span class="scenario-icon">{{ scenarioIcon(s) }}</span>
            <span class="scenario-label">{{ s.label }}</span>
          </div>
          <div class="scenario-body">
            <div class="scenario-stat">
              <span class="stat-label">Custo total</span>
              <span class="stat-value">{{ fmt(s.totalCost) }}</span>
            </div>
            <div class="scenario-stat">
              <span class="stat-label">Parcela</span>
              <span class="stat-value">{{ s.installments }}x de {{ fmt(s.installmentValue) }}</span>
            </div>
          </div>
          <div class="scenario-impact">
            <div v-for="m in s.monthlyImpact" :key="m.month" class="impact-row">
              <span class="impact-month">{{ m.label }}</span>
              <span class="impact-payment">-{{ fmt(m.payment) }}</span>
              <span class="impact-remaining" :class="balanceClass(m.remainingAfterSavings)">
                sobra {{ fmt(m.remainingAfterSavings) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.plan-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px;
}

.plan-header {
  text-align: center;
  margin-bottom: 28px;
}

.plan-header h1 {
  font-size: 1.6rem;
  margin: 8px 0 4px;
  color: var(--text-primary);
}

.plan-subtitle {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.back-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--text-muted);
}

.summary-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.summary-card {
  flex: 1;
  min-width: 180px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-lg);
  padding: 16px;
  text-align: center;
  border: 1px solid var(--border-color);
}

.summary-card.pix {
  background: var(--color-success-bg);
  border-color: var(--color-success);
}

.card-label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.card-value {
  display: block;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-savings {
  display: block;
  font-size: 0.8rem;
  color: var(--color-success);
  margin-top: 4px;
  font-weight: 600;
}

.section {
  margin-bottom: 32px;
}

.section h2 {
  font-size: 1.15rem;
  margin-bottom: 14px;
  color: var(--text-primary);
}

.table-wrapper {
  overflow-x: auto;
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--border-color);
}

.projection-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.projection-table th {
  background: var(--bg-secondary);
  padding: 10px 12px;
  text-align: right;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

.projection-table th:first-child {
  text-align: left;
}

.projection-table td {
  padding: 10px 12px;
  text-align: right;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
  color: var(--text-primary);
}

.month-cell {
  text-align: left !important;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-month {
  opacity: 0.5;
}

.positive {
  color: var(--color-success);
}

.negative {
  color: var(--color-danger);
}

.tight {
  color: var(--color-warning);
  font-weight: 600;
}

.recommendation-section .recommendation-box {
  background: var(--color-primary-light);
  border-radius: var(--border-radius-lg);
  padding: 20px;
  border-left: 4px solid var(--color-primary);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-primary);
}

.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.scenario-card {
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  overflow: hidden;
  transition: transform 0.15s, box-shadow 0.15s;
}

.scenario-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.scenario-card.viable {
  border-color: var(--color-success);
}

.scenario-card.best {
  border-color: var(--color-success);
  box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.25);
}

.scenario-card.not-viable {
  border-color: var(--color-danger);
  opacity: 0.85;
}

.scenario-header {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.scenario-icon {
  font-size: 1.3rem;
}

.scenario-label {
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.best-badge {
  background: var(--color-success);
  color: var(--text-inverse);
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 700;
}

.scenario-body {
  padding: 14px 16px;
  display: flex;
  gap: 20px;
}

.scenario-stat {
  flex: 1;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.stat-value {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.scenario-impact {
  padding: 0 16px 14px;
}

.impact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 0.82rem;
  border-top: 1px solid var(--border-color);
}

.impact-month {
  color: var(--text-secondary);
  min-width: 70px;
}

.impact-payment {
  color: var(--color-danger);
  font-weight: 500;
}

.impact-remaining {
  font-weight: 600;
  min-width: 120px;
  text-align: right;
}

@media (max-width: 600px) {
  .summary-cards {
    flex-direction: column;
  }
  .scenarios-grid {
    grid-template-columns: 1fr;
  }
  .projection-table {
    font-size: 0.78rem;
  }
  .projection-table th,
  .projection-table td {
    padding: 8px 6px;
  }
  .strategy-card-row {
    flex-direction: column;
  }
  .strategy-card-info {
    flex-wrap: wrap;
  }
}

/* Card Strategy Styles */
.card-overview {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-lg);
  padding: 16px 20px;
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.card-overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-overview-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.card-overview-value {
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}

.covers-badge {
  font-size: 0.7rem;
  background: var(--color-success);
  color: var(--text-inverse);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.no-covers-badge {
  font-size: 0.7rem;
  background: var(--color-danger);
  color: var(--text-inverse);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.strategy-card-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: 14px 16px;
  transition: border-color 0.2s;
}

.strategy-card-item.best-card {
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.strategy-card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.strategy-card-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.strategy-card-icon {
  font-size: 1.1rem;
}

.card-digits {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 0.85rem;
}

.strategy-card-info {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.85rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-label {
  color: var(--text-muted);
}

.info-value {
  font-weight: 600;
  color: var(--text-primary);
}

.days-value {
  font-weight: 700;
}

.closing-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  background: var(--color-warning);
  color: var(--text-inverse);
}

.closing-badge.open {
  background: var(--color-primary);
}

.strategies-section h3 {
  font-size: 1rem;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.strategies-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strategy-option {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  background: var(--bg-primary);
}

.strategy-option.recommended {
  border-color: var(--color-success);
  box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.2);
}

.strategy-option-header {
  background: var(--bg-secondary);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border-color);
}

.strategy-option-label {
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.strategy-allocations {
  padding: 12px 16px;
}

.allocation-row {
  display: grid;
  grid-template-columns: 200px 120px 1fr;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.allocation-row:last-child {
  border-bottom: none;
}

.allocation-card {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.allocation-amount {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.allocation-detail {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.no-strategy-box {
  background: var(--color-warning-bg, #fef3c7);
  border-radius: var(--border-radius-lg);
  padding: 16px 20px;
  border-left: 4px solid var(--color-warning);
  color: var(--text-primary);
}
</style>
