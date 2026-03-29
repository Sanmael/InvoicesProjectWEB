<script setup lang="ts">
import { ref, computed } from 'vue'
import { importService } from '@/services/importService'
import { creditCardService } from '@/services/creditCardService'
import { useToast } from '@/composables/useToast'
import type {
  ExtractedItem,
  BankTransaction,
  DocumentExtractionResult,
  BankImportResult,
  ImportResult,
  CreditCard,
} from '@/types'

const toast = useToast()

type ImportMode = 'document' | 'bank'
type ImportStep = 'upload' | 'review' | 'done'

const mode = ref<ImportMode>('document')
const step = ref<ImportStep>('upload')
const loading = ref(false)
const cards = ref<CreditCard[]>([])
const selectedCardId = ref<string | null>(null)

// Document OCR state
const docResult = ref<DocumentExtractionResult | null>(null)
const selectedItems = ref<Set<number>>(new Set())

// Bank import state
const bankResult = ref<BankImportResult | null>(null)
const selectedTransactions = ref<Set<number>>(new Set())

// Result
const importResult = ref<ImportResult | null>(null)

// Load cards
async function loadCards() {
  try {
    cards.value = await creditCardService.getAll()
  } catch {
    // Silently ignore - cards are optional
  }
}
loadCards()

const acceptedFileTypes = computed(() => {
  return mode.value === 'document'
    ? '.jpg,.jpeg,.png,.webp,.pdf'
    : '.ofx,.qfx,.csv'
})

const modeLabel = computed(() => {
  return mode.value === 'document' ? 'Fatura / Nota Fiscal' : 'Extrato Bancário (OFX/CSV)'
})

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function resetState() {
  step.value = 'upload'
  docResult.value = null
  bankResult.value = null
  selectedItems.value = new Set()
  selectedTransactions.value = new Set()
  importResult.value = null
  selectedCardId.value = null
}

function switchMode(newMode: ImportMode) {
  mode.value = newMode
  resetState()
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  loading.value = true
  try {
    if (mode.value === 'document') {
      docResult.value = await importService.extractDocument(file)
      if (docResult.value.items.length > 0) {
        selectedItems.value = new Set(docResult.value.items.map((_, i) => i))
        step.value = 'review'
      } else {
        toast.warning('Nenhum item financeiro encontrado no documento.')
      }
    } else {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'csv') {
        bankResult.value = await importService.importCsv(file)
      } else {
        bankResult.value = await importService.importOfx(file)
      }
      if (bankResult.value.transactions.length > 0) {
        selectedTransactions.value = new Set(bankResult.value.transactions.map((_, i) => i))
        step.value = 'review'
      } else {
        toast.warning('Nenhuma transação encontrada no arquivo.')
      }
    }
  } catch (err: any) {
    toast.error(err.response?.data ?? 'Erro ao processar arquivo.')
  } finally {
    loading.value = false
    input.value = ''
  }
}

function handleDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  const fakeEvent = { target: { files: [file], value: '' } } as unknown as Event
  handleFileUpload(fakeEvent)
}

function toggleItem(index: number) {
  const set = mode.value === 'document' ? selectedItems.value : selectedTransactions.value
  if (set.has(index)) set.delete(index)
  else set.add(index)
}

function toggleAll() {
  if (mode.value === 'document' && docResult.value) {
    if (selectedItems.value.size === docResult.value.items.length) {
      selectedItems.value.clear()
    } else {
      selectedItems.value = new Set(docResult.value.items.map((_, i) => i))
    }
  } else if (bankResult.value) {
    if (selectedTransactions.value.size === bankResult.value.transactions.length) {
      selectedTransactions.value.clear()
    } else {
      selectedTransactions.value = new Set(bankResult.value.transactions.map((_, i) => i))
    }
  }
}

const selectedTotal = computed(() => {
  if (mode.value === 'document' && docResult.value) {
    return docResult.value.items
      .filter((_, i) => selectedItems.value.has(i))
      .reduce((sum, item) => sum + item.amount, 0)
  }
  if (bankResult.value) {
    return bankResult.value.transactions
      .filter((_, i) => selectedTransactions.value.has(i))
      .reduce((sum, txn) => sum + txn.amount, 0)
  }
  return 0
})

const selectedCount = computed(() => {
  return mode.value === 'document' ? selectedItems.value.size : selectedTransactions.value.size
})

async function confirmImport() {
  loading.value = true
  try {
    if (mode.value === 'document' && docResult.value) {
      const items = docResult.value.items.filter((_, i) => selectedItems.value.has(i))
      importResult.value = await importService.confirmDocumentImport({
        items,
        creditCardId: selectedCardId.value,
      })
    } else if (bankResult.value) {
      const transactions = bankResult.value.transactions.filter((_, i) =>
        selectedTransactions.value.has(i),
      )
      importResult.value = await importService.confirmBankImport({
        transactions,
        creditCardId: selectedCardId.value,
      })
    }
    step.value = 'done'
    toast.success('Importação concluída!')
  } catch (err: any) {
    toast.error(err.response?.data ?? 'Erro ao importar.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="import-view">
    <div class="page-header">
      <h1>📄 Importar Dados</h1>
      <p class="subtitle">Importe faturas, notas fiscais ou extratos bancários</p>
    </div>

    <!-- Mode Tabs -->
    <div class="mode-tabs">
      <button
        :class="['tab', { active: mode === 'document' }]"
        @click="switchMode('document')"
      >
        📸 Fatura / Nota (IA)
      </button>
      <button
        :class="['tab', { active: mode === 'bank' }]"
        @click="switchMode('bank')"
      >
        🏦 Extrato OFX / CSV
      </button>
    </div>

    <!-- Step: Upload -->
    <div v-if="step === 'upload'" class="upload-section">
      <div class="upload-area" @dragover.prevent @drop.prevent="handleDrop">
        <div class="upload-icon">
          {{ mode === 'document' ? '📸' : '📁' }}
        </div>
        <h3>{{ modeLabel }}</h3>
        <p v-if="mode === 'document'">
          Envie uma foto ou PDF de fatura de cartão, nota fiscal ou boleto.<br />
          A IA irá extrair automaticamente os itens e categorias.
        </p>
        <p v-else>
          Exporte o extrato do seu banco no formato OFX ou CSV.<br />
          Todos os bancos brasileiros (Nubank, Inter, Itaú, BB, etc.) suportam OFX.
        </p>
        <label class="upload-btn">
          <input type="file" :accept="acceptedFileTypes" @change="handleFileUpload" hidden />
          {{ loading ? 'Processando...' : 'Selecionar Arquivo' }}
        </label>
      </div>

      <div v-if="mode === 'bank'" class="help-section">
        <h4>💡 Como exportar OFX do seu banco:</h4>
        <ul>
          <li><strong>Nubank:</strong> App → Extrato → Compartilhar → Arquivo OFX</li>
          <li><strong>Inter:</strong> App → Extrato → Exportar → OFX</li>
          <li><strong>Itaú:</strong> Internet Banking → Extrato → Salvar como OFX</li>
          <li><strong>Bradesco:</strong> Internet Banking → Extrato → Exportar OFX</li>
          <li><strong>BB:</strong> App → Extrato → Exportar → OFX</li>
        </ul>
      </div>
    </div>

    <!-- Step: Review -->
    <div v-if="step === 'review'" class="review-section">
      <div class="review-header">
        <div>
          <h3 v-if="mode === 'document' && docResult">
            {{ docResult.summary || docResult.fileName }}
          </h3>
          <h3 v-else-if="bankResult">
            {{ bankResult.bankName ? `${bankResult.bankName} - ` : '' }}{{ bankResult.fileName }}
          </h3>
          <p class="count-info">
            {{ selectedCount }} de
            {{
              mode === 'document'
                ? docResult?.items.length
                : bankResult?.transactions.length
            }}
            itens selecionados · Total: {{ formatCurrency(selectedTotal) }}
          </p>
        </div>
        <div class="review-actions">
          <button class="btn-secondary" @click="toggleAll">
            {{ selectedCount === (mode === 'document' ? docResult?.items.length : bankResult?.transactions.length) ? 'Desmarcar' : 'Marcar' }} Todos
          </button>
          <button class="btn-secondary" @click="resetState">Cancelar</button>
        </div>
      </div>

      <!-- Card selector for card_purchase items -->
      <div v-if="cards.length > 0" class="card-selector">
        <label>Vincular compras de cartão a:</label>
        <select v-model="selectedCardId">
          <option :value="null">Criar como débito avulso</option>
          <option v-for="card in cards" :key="card.id" :value="card.id">
            {{ card.name }} (final {{ card.lastFourDigits }})
          </option>
        </select>
      </div>

      <!-- Document items -->
      <div v-if="mode === 'document' && docResult" class="items-list">
        <div
          v-for="(item, index) in docResult.items"
          :key="index"
          :class="['item-row', { selected: selectedItems.has(index) }]"
          @click="toggleItem(index)"
        >
          <input type="checkbox" :checked="selectedItems.has(index)" @click.stop="toggleItem(index)" />
          <div class="item-info">
            <span class="item-desc">{{ item.description }}</span>
            <span class="item-meta">
              {{ item.date }} · {{ item.category || 'Outros' }}
              <span v-if="item.installments > 1"> · {{ item.installments }}x</span>
            </span>
          </div>
          <span :class="['item-type', item.type]">
            {{ item.type === 'card_purchase' ? '💳' : '📋' }}
          </span>
          <span class="item-amount">{{ formatCurrency(item.amount) }}</span>
        </div>
      </div>

      <!-- Bank transactions -->
      <div v-if="mode === 'bank' && bankResult" class="items-list">
        <div
          v-for="(txn, index) in bankResult.transactions"
          :key="index"
          :class="['item-row', { selected: selectedTransactions.has(index) }]"
          @click="toggleItem(index)"
        >
          <input
            type="checkbox"
            :checked="selectedTransactions.has(index)"
            @click.stop="toggleItem(index)"
          />
          <div class="item-info">
            <span class="item-desc">{{ txn.description }}</span>
            <span class="item-meta">
              {{ txn.date }} · {{ txn.category || 'Outros' }}
              <span v-if="txn.memo"> · {{ txn.memo }}</span>
            </span>
          </div>
          <span :class="['txn-type', txn.transactionType]">
            {{ txn.transactionType === 'credit' ? '📈' : '📉' }}
          </span>
          <span :class="['item-amount', txn.transactionType]">
            {{ txn.transactionType === 'credit' ? '+' : '-' }}{{ formatCurrency(txn.amount) }}
          </span>
        </div>
      </div>

      <div class="review-footer">
        <button class="btn-primary" :disabled="selectedCount === 0 || loading" @click="confirmImport">
          {{ loading ? 'Importando...' : `Importar ${selectedCount} itens` }}
        </button>
      </div>
    </div>

    <!-- Step: Done -->
    <div v-if="step === 'done' && importResult" class="done-section">
      <div class="done-icon">✅</div>
      <h3>Importação Concluída!</h3>
      <div class="done-stats">
        <div class="stat">
          <span class="stat-value">{{ importResult.totalItems }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ importResult.debtsCreated }}</span>
          <span class="stat-label">Débitos</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ importResult.cardPurchasesCreated }}</span>
          <span class="stat-label">Compras Cartão</span>
        </div>
      </div>
      <div class="done-details">
        <div v-for="(detail, i) in importResult.details" :key="i" class="detail-line">
          {{ detail }}
        </div>
      </div>
      <button class="btn-primary" @click="resetState">Nova Importação</button>
    </div>
  </div>
</template>

<style scoped>
.import-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 1.8rem;
  margin: 0;
}

.subtitle {
  color: var(--color-text-secondary, #888);
  margin-top: 4px;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.tab {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--color-border, #333);
  border-radius: 12px;
  background: var(--color-background-soft, #1a1a2e);
  color: var(--color-text, #fff);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  border-color: var(--color-primary, #818cf8);
  background: var(--color-primary-soft, rgba(129, 140, 248, 0.1));
  color: var(--color-primary, #818cf8);
}

.tab:hover:not(.active) {
  border-color: var(--color-text-secondary, #666);
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.upload-area {
  border: 2px dashed var(--color-border, #333);
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
  transition: border-color 0.2s;
}

.upload-area:hover {
  border-color: var(--color-primary, #818cf8);
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.upload-area h3 {
  margin: 0 0 8px;
}

.upload-area p {
  color: var(--color-text-secondary, #888);
  margin-bottom: 20px;
  line-height: 1.6;
}

.upload-btn {
  display: inline-block;
  padding: 12px 32px;
  background: var(--color-primary, #818cf8);
  color: #fff;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.upload-btn:hover {
  opacity: 0.9;
}

.help-section {
  background: var(--color-background-soft, #1a1a2e);
  border-radius: 12px;
  padding: 20px;
}

.help-section h4 {
  margin: 0 0 12px;
}

.help-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.help-section li {
  padding: 6px 0;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.9rem;
}

.review-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.review-header h3 {
  margin: 0;
}

.count-info {
  color: var(--color-text-secondary, #888);
  font-size: 0.9rem;
  margin-top: 4px;
}

.review-actions {
  display: flex;
  gap: 8px;
}

.card-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-background-soft, #1a1a2e);
  border-radius: 10px;
}

.card-selector label {
  font-size: 0.9rem;
  white-space: nowrap;
}

.card-selector select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #333);
  border-radius: 8px;
  background: var(--color-background, #0f0f23);
  color: var(--color-text, #fff);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 500px;
  overflow-y: auto;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-background-soft, #1a1a2e);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;
}

.item-row:hover {
  background: var(--color-background-mute, #252540);
}

.item-row.selected {
  border-color: var(--color-primary, #818cf8);
  background: var(--color-primary-soft, rgba(129, 140, 248, 0.05));
}

.item-row input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary, #818cf8);
  cursor: pointer;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-desc {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #888);
}

.item-type,
.txn-type {
  font-size: 1.2rem;
}

.item-amount {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
}

.item-amount.credit {
  color: #34d399;
}

.item-amount.debit {
  color: #f87171;
}

.review-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.btn-primary {
  padding: 12px 32px;
  background: var(--color-primary, #818cf8);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--color-background-soft, #1a1a2e);
  color: var(--color-text, #fff);
  border: 1px solid var(--color-border, #333);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: border-color 0.2s;
}

.btn-secondary:hover {
  border-color: var(--color-text-secondary, #666);
}

.done-section {
  text-align: center;
  padding: 40px 20px;
}

.done-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.done-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 24px 0;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-primary, #818cf8);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #888);
}

.done-details {
  text-align: left;
  max-width: 500px;
  margin: 24px auto;
  background: var(--color-background-soft, #1a1a2e);
  border-radius: 12px;
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.detail-line {
  padding: 4px 0;
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .import-view {
    padding: 16px;
  }

  .mode-tabs {
    flex-direction: column;
  }

  .review-header {
    flex-direction: column;
  }

  .card-selector {
    flex-direction: column;
    align-items: stretch;
  }

  .done-stats {
    gap: 16px;
  }
}
</style>
