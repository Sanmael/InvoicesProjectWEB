<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { savingsGoalService } from '@/services/savingsGoalService'
import type { SavingsGoal, CreateSavingsGoalDto } from '@/types'

const goals = ref<SavingsGoal[]>([])
const loading = ref(true)
const error = ref('')
const showModal = ref(false)
const showAddModal = ref(false)
const selectedGoal = ref<SavingsGoal | null>(null)
const addAmount = ref(0)

const categories = [
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer',
  'Vestuário', 'Assinaturas', 'Mercado', 'Pets', 'Presentes', 'Viagem',
  'Tecnologia', 'Serviços', 'Família', 'Investimentos', 'Impostos', 'Outros',
]

const formData = ref<CreateSavingsGoalDto>({
  title: '',
  description: '',
  targetAmount: 0,
  currentAmount: 0,
  deadline: undefined,
  category: 'Outros',
})

const activeGoals = computed(() => goals.value.filter(g => !g.isCompleted))
const completedGoals = computed(() => goals.value.filter(g => g.isCompleted))
const totalSaved = computed(() => goals.value.reduce((s, g) => s + g.currentAmount, 0))
const totalTarget = computed(() => activeGoals.value.reduce((s, g) => s + g.targetAmount, 0))

async function fetchGoals() {
  loading.value = true
  error.value = ''
  try {
    goals.value = await savingsGoalService.getAll()
  } catch {
    error.value = 'Erro ao carregar metas'
  } finally {
    loading.value = false
  }
}

onMounted(fetchGoals)

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

function openModal() {
  formData.value = { title: '', description: '', targetAmount: 0, currentAmount: 0, deadline: undefined, category: 'Outros' }
  showModal.value = true
}

function openAddModal(goal: SavingsGoal) {
  selectedGoal.value = goal
  addAmount.value = 0
  showAddModal.value = true
}

async function handleSubmit() {
  await savingsGoalService.create(formData.value)
  showModal.value = false
  await fetchGoals()
}

async function handleAddAmount() {
  if (!selectedGoal.value || addAmount.value <= 0) return
  await savingsGoalService.addAmount(selectedGoal.value.id, addAmount.value)
  showAddModal.value = false
  selectedGoal.value = null
  await fetchGoals()
}

async function handleDelete(id: string) {
  if (confirm('Tem certeza que deseja excluir esta meta?')) {
    await savingsGoalService.delete(id)
    await fetchGoals()
  }
}

function getProgressColor(percent: number) {
  if (percent >= 100) return 'var(--color-success)'
  if (percent >= 60) return 'var(--color-primary)'
  if (percent >= 30) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function getDaysLeft(deadline: string | null) {
  if (!deadline) return null
  const target = new Date(deadline + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}
</script>

<template>
  <div class="goals-page">
    <header class="page-header">
      <div>
        <h1>🎯 Metas de Economia</h1>
        <p>Defina objetivos e acompanhe seu progresso</p>
      </div>
      <button @click="openModal" class="btn-primary">+ Nova Meta</button>
    </header>

    <!-- Summary Cards -->
    <div class="summary-grid" v-if="goals.length > 0">
      <div class="summary-card">
        <span class="summary-icon">💰</span>
        <div>
          <span class="summary-label">Total Guardado</span>
          <span class="summary-value">{{ formatCurrency(totalSaved) }}</span>
        </div>
      </div>
      <div class="summary-card">
        <span class="summary-icon">🎯</span>
        <div>
          <span class="summary-label">Meta Total (ativas)</span>
          <span class="summary-value">{{ formatCurrency(totalTarget) }}</span>
        </div>
      </div>
      <div class="summary-card">
        <span class="summary-icon">🏆</span>
        <div>
          <span class="summary-label">Metas Concluídas</span>
          <span class="summary-value">{{ completedGoals.length }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Carregando...</div>
    <div v-else-if="error" class="error-alert">{{ error }}</div>

    <div v-else-if="goals.length === 0" class="empty-state">
      <p>Nenhuma meta cadastrada</p>
      <button @click="openModal" class="btn-primary">Criar primeira meta</button>
    </div>

    <template v-else>
      <!-- Active Goals -->
      <h2 class="section-title" v-if="activeGoals.length > 0">Metas Ativas ({{ activeGoals.length }})</h2>
      <div class="goals-grid">
        <div v-for="goal in activeGoals" :key="goal.id" class="goal-card">
          <div class="goal-header">
            <div>
              <h3>{{ goal.title }}</h3>
              <span class="goal-category">{{ goal.category }}</span>
            </div>
            <button @click="handleDelete(goal.id)" class="btn-danger-icon" title="Excluir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>

          <p v-if="goal.description" class="goal-description">{{ goal.description }}</p>

          <div class="progress-section">
            <div class="progress-header">
              <span>{{ formatCurrency(goal.currentAmount) }}</span>
              <span>{{ formatCurrency(goal.targetAmount) }}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: goal.progressPercent + '%', background: getProgressColor(goal.progressPercent) }"></div>
            </div>
            <span class="progress-percent">{{ goal.progressPercent }}%</span>
          </div>

          <div class="goal-footer">
            <span v-if="goal.deadline" class="goal-deadline" :class="{ overdue: getDaysLeft(goal.deadline)! < 0 }">
              <template v-if="getDaysLeft(goal.deadline)! > 0">⏳ {{ getDaysLeft(goal.deadline) }} dias restantes</template>
              <template v-else-if="getDaysLeft(goal.deadline) === 0">📅 Prazo é hoje!</template>
              <template v-else>⚠️ Atrasada {{ Math.abs(getDaysLeft(goal.deadline)!) }} dias</template>
            </span>
            <span v-else class="goal-deadline">Sem prazo definido</span>
            <button @click="openAddModal(goal)" class="btn-add-amount">+ Aportar</button>
          </div>
        </div>
      </div>

      <!-- Completed Goals -->
      <template v-if="completedGoals.length > 0">
        <h2 class="section-title completed-title">✅ Metas Concluídas ({{ completedGoals.length }})</h2>
        <div class="goals-grid">
          <div v-for="goal in completedGoals" :key="goal.id" class="goal-card completed">
            <div class="goal-header">
              <div>
                <h3>{{ goal.title }}</h3>
                <span class="goal-category">{{ goal.category }}</span>
              </div>
              <span class="completed-badge">🏆 Concluída</span>
            </div>
            <div class="progress-section">
              <div class="progress-header">
                <span>{{ formatCurrency(goal.currentAmount) }}</span>
                <span>{{ formatCurrency(goal.targetAmount) }}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: 100%; background: var(--color-success)"></div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- Modal: Nova Meta -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Nova Meta</h2>
          <button type="button" class="close-btn" @click="showModal = false">✕</button>
        </div>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Título</label>
            <input v-model="formData.title" placeholder="Ex: Novo setup de VR" required />
          </div>
          <div class="form-group">
            <label>Descrição</label>
            <textarea v-model="formData.description" rows="2" placeholder="Opcional"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Valor Alvo</label>
              <input v-model.number="formData.targetAmount" type="number" step="0.01" min="1" required />
            </div>
            <div class="form-group">
              <label>Já Guardado</label>
              <input v-model.number="formData.currentAmount" type="number" step="0.01" min="0" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Prazo</label>
              <input v-model="formData.deadline" type="date" />
            </div>
            <div class="form-group">
              <label>Categoria</label>
              <select v-model="formData.category">
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showModal = false" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Criar Meta</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Aportar Valor -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal modal-small">
        <div class="modal-header">
          <h2>Aportar em "{{ selectedGoal?.title }}"</h2>
          <button type="button" class="close-btn" @click="showAddModal = false">✕</button>
        </div>
        <p class="modal-info">
          Progresso atual: {{ formatCurrency(selectedGoal?.currentAmount ?? 0) }} de {{ formatCurrency(selectedGoal?.targetAmount ?? 0) }}
        </p>
        <form @submit.prevent="handleAddAmount">
          <div class="form-group">
            <label>Valor do Aporte</label>
            <input v-model.number="addAmount" type="number" step="0.01" min="0.01" required />
          </div>
          <div class="modal-actions">
            <button type="button" @click="showAddModal = false" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Aportar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.goals-page { max-width: 1100px; margin: 0 auto; }

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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-sm);
}

.summary-icon { font-size: 2rem; }
.summary-label { display: block; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; }
.summary-value { display: block; font-size: 1.3rem; font-weight: 700; color: var(--text-primary); }

.section-title {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin: 2rem 0 1rem;
}
.completed-title { opacity: 0.7; }

.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.goal-card {
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease;
}
.goal-card:hover { transform: translateY(-2px); }
.goal-card.completed { opacity: 0.7; }

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}
.goal-header h3 { margin: 0; color: var(--text-primary); font-size: 1.1rem; }
.goal-category {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--color-info-bg);
  color: var(--color-info);
}
.completed-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-success);
}

.goal-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
}

.progress-section { margin-bottom: 1rem; }
.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}
.progress-track {
  height: 10px;
  background: var(--bg-secondary);
  border-radius: 5px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
}
.progress-percent {
  display: block;
  text-align: right;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0.25rem;
}

.goal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.goal-deadline {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.goal-deadline.overdue { color: var(--color-danger); font-weight: 600; }

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
.btn-primary:hover { background: var(--color-primary-hover); transform: translateY(-2px); }

.btn-add-amount {
  background: var(--color-success);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-add-amount:hover { opacity: 0.85; }

.btn-danger-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--border-radius);
  transition: all 0.2s ease;
}
.btn-danger-icon:hover { color: var(--color-danger); background: var(--color-danger-bg); }

.loading, .empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.error-alert {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  padding: 1rem;
  border-radius: var(--border-radius);
  margin-bottom: 1rem;
}

/* Modal */
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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-small { max-width: 400px; }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.modal-header h2 { margin: 0; color: var(--text-primary); font-size: 1.15rem; }
.modal-info {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
}
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
.close-btn:hover { color: var(--text-primary); background: var(--border-color); }

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
.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus { outline: none; border-color: var(--color-primary); }

.form-row { display: flex; gap: 1rem; }
.form-row .form-group { flex: 1; }

.modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
.modal-actions .btn-secondary,
.modal-actions .btn-primary { flex: 1; padding: 0.75rem; }
.modal-actions .btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
}
.modal-actions .btn-secondary:hover { background: var(--border-color); }

@media (max-width: 640px) {
  .summary-grid { grid-template-columns: 1fr; }
  .goals-grid { grid-template-columns: 1fr; }
  .form-row { flex-direction: column; gap: 0; }
  .modal { padding: 1.5rem; margin: 0.5rem; }
}
</style>
