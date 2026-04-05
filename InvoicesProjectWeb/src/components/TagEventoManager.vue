<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { tagEventoService } from '@/services/tagEventoService'
import type { TagEvento, CreateTagEventoDto, UpdateTagEventoDto } from '@/types'

const tags = ref<TagEvento[]>([])
const loading = ref(true)
const error = ref('')
const showModal = ref(false)
const editingId = ref<string | null>(null)

const formData = ref<CreateTagEventoDto>({
  nome: '',
  descricao: '',
  dataInicio: undefined,
  dataFim: undefined,
})

const activeTags = computed(() =>
  tags.value.filter((t) => !t.dataFim || new Date(t.dataFim) >= new Date()),
)
const pastTags = computed(() =>
  tags.value.filter((t) => t.dataFim && new Date(t.dataFim) < new Date()),
)
const totalGeral = computed(() => tags.value.reduce((s, t) => s + t.totalGastos, 0))

async function fetchTags() {
  loading.value = true
  error.value = ''
  try {
    tags.value = await tagEventoService.getAll()
  } catch {
    error.value = 'Erro ao carregar eventos'
  } finally {
    loading.value = false
  }
}

onMounted(fetchTags)

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function openCreateModal() {
  editingId.value = null
  formData.value = { nome: '', descricao: '', dataInicio: undefined, dataFim: undefined }
  showModal.value = true
}

function openEditModal(tag: TagEvento) {
  editingId.value = tag.id
  formData.value = {
    nome: tag.nome,
    descricao: tag.descricao ?? '',
    dataInicio: tag.dataInicio?.split('T')[0],
    dataFim: tag.dataFim?.split('T')[0],
  }
  showModal.value = true
}

async function handleSubmit() {
  try {
    if (editingId.value) {
      const dto: UpdateTagEventoDto = { ...formData.value }
      await tagEventoService.update(editingId.value, dto)
    } else {
      await tagEventoService.create(formData.value)
    }
    showModal.value = false
    await fetchTags()
  } catch {
    error.value = editingId.value ? 'Erro ao atualizar evento' : 'Erro ao criar evento'
  }
}

async function handleDelete(id: string) {
  if (confirm('Tem certeza que deseja excluir este evento?')) {
    try {
      await tagEventoService.delete(id)
      await fetchTags()
    } catch {
      error.value = 'Erro ao excluir evento'
    }
  }
}

function getDaysInfo(tag: TagEvento) {
  if (!tag.dataInicio && !tag.dataFim) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (tag.dataFim) {
    const end = new Date(tag.dataFim)
    end.setHours(0, 0, 0, 0)
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: 'Encerrado', class: 'status-ended' }
    if (diff === 0) return { text: 'Encerra hoje', class: 'status-today' }
    return { text: `${diff} dias restantes`, class: 'status-active' }
  }
  return { text: 'Em andamento', class: 'status-active' }
}
</script>

<template>
  <div class="eventos-page">
    <header class="page-header">
      <div>
        <h1>🏷️ Eventos / Tags Temporais</h1>
        <p>Agrupe gastos por viagens, reformas, casamentos e outros eventos</p>
      </div>
      <button @click="openCreateModal" class="btn-primary">+ Novo Evento</button>
    </header>

    <!-- Summary -->
    <div class="summary-grid" v-if="tags.length > 0">
      <div class="summary-card">
        <span class="summary-icon">📋</span>
        <div>
          <span class="summary-label">Total de Eventos</span>
          <span class="summary-value">{{ tags.length }}</span>
        </div>
      </div>
      <div class="summary-card">
        <span class="summary-icon">🟢</span>
        <div>
          <span class="summary-label">Ativos</span>
          <span class="summary-value">{{ activeTags.length }}</span>
        </div>
      </div>
      <div class="summary-card">
        <span class="summary-icon">💸</span>
        <div>
          <span class="summary-label">Total Gasto em Eventos</span>
          <span class="summary-value">{{ formatCurrency(totalGeral) }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Carregando...</div>
    <div v-else-if="error" class="error-alert">{{ error }}</div>

    <div v-else-if="tags.length === 0" class="empty-state">
      <p>Nenhum evento cadastrado</p>
      <button @click="openCreateModal" class="btn-primary">Criar primeiro evento</button>
    </div>

    <template v-else>
      <!-- Active events -->
      <h2 class="section-title" v-if="activeTags.length > 0">
        Eventos Ativos ({{ activeTags.length }})
      </h2>
      <div class="tags-grid">
        <div v-for="tag in activeTags" :key="tag.id" class="tag-card">
          <div class="tag-header">
            <div>
              <h3>{{ tag.nome }}</h3>
              <span class="tag-status" :class="getDaysInfo(tag)?.class">
                {{ getDaysInfo(tag)?.text ?? 'Sem período' }}
              </span>
            </div>
            <div class="tag-actions">
              <button @click="openEditModal(tag)" class="btn-icon" title="Editar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button @click="handleDelete(tag.id)" class="btn-danger-icon" title="Excluir">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>

          <p v-if="tag.descricao" class="tag-description">{{ tag.descricao }}</p>

          <div class="tag-dates">
            <span>📅 {{ formatDate(tag.dataInicio) }} — {{ formatDate(tag.dataFim) }}</span>
          </div>

          <div class="tag-stats">
            <div class="stat">
              <span class="stat-label">Débitos</span>
              <span class="stat-value">{{ tag.totalDebts }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Compras Cartão</span>
              <span class="stat-value">{{ tag.totalCardPurchases }}</span>
            </div>
            <div class="stat total">
              <span class="stat-label">Total Gasto</span>
              <span class="stat-value">{{ formatCurrency(tag.totalGastos) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Past events -->
      <template v-if="pastTags.length > 0">
        <h2 class="section-title past-title">📁 Eventos Encerrados ({{ pastTags.length }})</h2>
        <div class="tags-grid">
          <div v-for="tag in pastTags" :key="tag.id" class="tag-card past">
            <div class="tag-header">
              <div>
                <h3>{{ tag.nome }}</h3>
                <span class="tag-status status-ended">Encerrado</span>
              </div>
              <div class="tag-actions">
                <button @click="openEditModal(tag)" class="btn-icon" title="Editar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button @click="handleDelete(tag.id)" class="btn-danger-icon" title="Excluir">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div class="tag-dates">
              <span>📅 {{ formatDate(tag.dataInicio) }} — {{ formatDate(tag.dataFim) }}</span>
            </div>
            <div class="tag-stats">
              <div class="stat total">
                <span class="stat-label">Total Gasto</span>
                <span class="stat-value">{{ formatCurrency(tag.totalGastos) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- Modal: Criar/Editar Evento -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingId ? 'Editar Evento' : 'Novo Evento' }}</h2>
          <button type="button" class="close-btn" @click="showModal = false">✕</button>
        </div>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Nome do Evento</label>
            <input v-model="formData.nome" placeholder="Ex: Viagem para SP" required />
          </div>
          <div class="form-group">
            <label>Descrição</label>
            <textarea v-model="formData.descricao" rows="2" placeholder="Opcional"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Data Início</label>
              <input v-model="formData.dataInicio" type="date" />
            </div>
            <div class="form-group">
              <label>Data Fim</label>
              <input v-model="formData.dataFim" type="date" />
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showModal = false" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">
              {{ editingId ? 'Salvar' : 'Criar Evento' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eventos-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.page-header h1 {
  margin: 0;
  color: var(--text-primary);
}
.page-header p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
}

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

.summary-icon {
  font-size: 2rem;
}
.summary-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
}
.summary-value {
  display: block;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
}

.section-title {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin: 2rem 0 1rem;
}
.past-title {
  opacity: 0.7;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.tag-card {
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease;
}
.tag-card:hover {
  transform: translateY(-2px);
}
.tag-card.past {
  opacity: 0.7;
}

.tag-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}
.tag-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.1rem;
}

.tag-status {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}
.status-active {
  background: var(--color-success-bg, rgba(16, 185, 129, 0.1));
  color: var(--color-success);
}
.status-today {
  background: var(--color-warning-bg, rgba(245, 158, 11, 0.1));
  color: var(--color-warning);
}
.status-ended {
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.tag-actions {
  display: flex;
  gap: 0.25rem;
}

.tag-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
}

.tag-dates {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.tag-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  flex: 1;
  min-width: 80px;
  text-align: center;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
}
.stat.total {
  background: var(--color-primary-bg, rgba(99, 102, 241, 0.1));
}
.stat-label {
  display: block;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}
.stat-value {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
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

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 600;
  cursor: pointer;
}

.btn-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--border-radius);
  transition: all 0.2s ease;
}
.btn-icon:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg, rgba(99, 102, 241, 0.1));
}

.btn-danger-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--border-radius);
  transition: all 0.2s ease;
}
.btn-danger-icon:hover {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}

.loading,
.empty-state {
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
  background: rgba(0, 0, 0, 0.5);
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
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.15rem;
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
}

.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.65rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-primary);
  font-size: 0.95rem;
  box-sizing: border-box;
}
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  .tags-grid {
    grid-template-columns: 1fr;
  }
}
</style>
