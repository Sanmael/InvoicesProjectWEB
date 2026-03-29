<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { notificationService } from '@/services/notificationService'
import { telegramService } from '@/services/telegramService'
import type {
  EmailNotification,
  NotificationPreferenceCreateDto,
  NotificationSummary,
  TelegramStatus,
  UpdateUserDto,
} from '@/types'

const authStore = useAuthStore()

const successMsg = ref('')
const errorMsg = ref('')
const notificationSuccessMsg = ref('')
const notificationErrorMsg = ref('')
const notificationsLoading = ref(false)
const notificationSummary = ref<NotificationSummary | null>(null)
const notificationHistory = ref<EmailNotification[]>([])

const notificationForm = ref<NotificationPreferenceCreateDto>({
  notifyLowBalance: true,
  lowBalanceThreshold: 500,
  notifyInvoiceClosed: true,
  daysBeforeInvoiceCloseNotification: 3,
  notifyCardLimitNearMax: true,
  cardLimitWarningPercentage: 80,
  notifyUpcomingDebts: true,
  daysBeforeDebtDueNotification: 5,
  notifyUpcomingReceivables: true,
  daysBeforeReceivableNotification: 3,
  emailNotificationsEnabled: true,
})

const profileForm = ref<UpdateUserDto>({
  name: authStore.user?.name ?? '',
  email: authStore.user?.email ?? '',
})

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

async function handleProfileSubmit() {
  successMsg.value = ''
  errorMsg.value = ''
  try {
    await authStore.updateProfile({ name: profileForm.value.name, email: profileForm.value.email })
    successMsg.value = 'Dados atualizados com sucesso!'
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || 'Erro ao atualizar dados'
  }
}

async function handlePasswordSubmit() {
  successMsg.value = ''
  errorMsg.value = ''
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    errorMsg.value = 'As senhas não coincidem'
    return
  }
  if (passwordForm.value.newPassword.length < 6) {
    errorMsg.value = 'A nova senha deve ter no mínimo 6 caracteres'
    return
  }
  try {
    await authStore.updateProfile({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    })
    successMsg.value = 'Senha alterada com sucesso!'
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || 'Erro ao alterar senha'
  }
}

async function loadNotificationPreferences() {
  notificationsLoading.value = true
  notificationErrorMsg.value = ''

  try {
    const [preferences, summary, history] = await Promise.all([
      notificationService.getPreferences(),
      notificationService.getSummary(),
      notificationService.getHistory(10),
    ])

    notificationForm.value = {
      notifyLowBalance: preferences.notifyLowBalance,
      lowBalanceThreshold: preferences.lowBalanceThreshold,
      notifyInvoiceClosed: preferences.notifyInvoiceClosed,
      daysBeforeInvoiceCloseNotification: preferences.daysBeforeInvoiceCloseNotification,
      notifyCardLimitNearMax: preferences.notifyCardLimitNearMax,
      cardLimitWarningPercentage: preferences.cardLimitWarningPercentage,
      notifyUpcomingDebts: preferences.notifyUpcomingDebts,
      daysBeforeDebtDueNotification: preferences.daysBeforeDebtDueNotification,
      notifyUpcomingReceivables: preferences.notifyUpcomingReceivables,
      daysBeforeReceivableNotification: preferences.daysBeforeReceivableNotification,
      emailNotificationsEnabled: preferences.emailNotificationsEnabled,
    }
    notificationSummary.value = summary
    notificationHistory.value = history
  } catch (e: any) {
    notificationErrorMsg.value = e.response?.data?.message || 'Erro ao carregar preferências de notificação'
  } finally {
    notificationsLoading.value = false
  }
}

async function handleNotificationSubmit() {
  notificationSuccessMsg.value = ''
  notificationErrorMsg.value = ''
  notificationsLoading.value = true

  try {
    await notificationService.savePreferences(notificationForm.value)
    notificationSummary.value = await notificationService.getSummary()
    notificationHistory.value = await notificationService.getHistory(10)
    notificationSuccessMsg.value = 'Preferências de notificação salvas com sucesso!'
  } catch (e: any) {
    notificationErrorMsg.value = e.response?.data?.message || 'Erro ao salvar preferências de notificação'
  } finally {
    notificationsLoading.value = false
  }
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

// Telegram
const telegramStatus = ref<TelegramStatus | null>(null)
const telegramLoading = ref(false)
const telegramLinkUrl = ref('')

async function loadTelegramStatus() {
  try {
    telegramStatus.value = await telegramService.getStatus()
  } catch {
    // Telegram not configured
  }
}

async function generateTelegramLink() {
  telegramLoading.value = true
  try {
    const link = await telegramService.generateLink()
    telegramLinkUrl.value = `https://t.me/${link.botUsername}?start=${link.linkToken}`
  } catch (e: any) {
    notificationErrorMsg.value = e.response?.data?.message || 'Erro ao gerar link do Telegram'
  } finally {
    telegramLoading.value = false
  }
}

async function toggleTelegram(enabled: boolean) {
  telegramLoading.value = true
  try {
    await telegramService.toggle(enabled)
    telegramStatus.value = await telegramService.getStatus()
  } catch (e: any) {
    notificationErrorMsg.value = e.response?.data?.message || 'Erro ao alterar Telegram'
  } finally {
    telegramLoading.value = false
  }
}

async function unlinkTelegram() {
  telegramLoading.value = true
  try {
    await telegramService.unlink()
    telegramStatus.value = await telegramService.getStatus()
    telegramLinkUrl.value = ''
  } catch (e: any) {
    notificationErrorMsg.value = e.response?.data?.message || 'Erro ao desvincular Telegram'
  } finally {
    telegramLoading.value = false
  }
}

onMounted(() => {
  loadNotificationPreferences()
  loadTelegramStatus()
})
</script>

<template>
  <div class="profile-page">
    <header class="page-header">
      <h1>👤 Meu Perfil</h1>
      <p>Gerencie seus dados pessoais</p>
    </header>

    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>
    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="notificationSuccessMsg" class="alert alert-success">{{ notificationSuccessMsg }}</div>
    <div v-if="notificationErrorMsg" class="alert alert-error">{{ notificationErrorMsg }}</div>

    <div class="profile-grid">
      <!-- Dados pessoais -->
      <div class="card">
        <h2>Dados Pessoais</h2>
        <form @submit.prevent="handleProfileSubmit">
          <div class="form-group">
            <label>Nome</label>
            <input v-model="profileForm.name" required />
          </div>
          <div class="form-group">
            <label>E-mail</label>
            <input v-model="profileForm.email" type="email" required />
          </div>
          <div class="form-group readonly-group">
            <label>Membro desde</label>
            <span class="readonly-value">
              {{ authStore.user?.createdAt ? new Date(authStore.user.createdAt).toLocaleDateString('pt-BR') : '—' }}
            </span>
          </div>
          <button type="submit" class="btn-primary" :disabled="authStore.loading">
            {{ authStore.loading ? 'Salvando...' : 'Salvar dados' }}
          </button>
        </form>
      </div>

      <!-- Alterar senha -->
      <div class="card">
        <h2>Alterar Senha</h2>
        <form @submit.prevent="handlePasswordSubmit">
          <div class="form-group">
            <label>Senha atual</label>
            <input v-model="passwordForm.currentPassword" type="password" required />
          </div>
          <div class="form-group">
            <label>Nova senha</label>
            <input v-model="passwordForm.newPassword" type="password" required minlength="6" />
          </div>
          <div class="form-group">
            <label>Confirmar nova senha</label>
            <input v-model="passwordForm.confirmPassword" type="password" required />
          </div>
          <button type="submit" class="btn-primary" :disabled="authStore.loading">
            {{ authStore.loading ? 'Salvando...' : 'Alterar senha' }}
          </button>
        </form>
      </div>

      <div class="card notifications-card">
        <h2>Preferências de Avisos por E-mail</h2>
        <p class="section-description">Configure quando o sistema deve te avisar sobre saldo, fatura, limite e vencimentos.</p>

        <form @submit.prevent="handleNotificationSubmit">
          <label class="toggle-row">
            <input v-model="notificationForm.emailNotificationsEnabled" type="checkbox" />
            <span>Ativar notificações por e-mail</span>
          </label>

          <div class="form-grid">
            <div class="form-group checkbox-group">
              <label class="toggle-row">
                <input v-model="notificationForm.notifyLowBalance" type="checkbox" />
                <span>Avisar saldo baixo</span>
              </label>
              <input v-model.number="notificationForm.lowBalanceThreshold" type="number" min="0" step="0.01" />
              <small>Valor mínimo de saldo restante</small>
            </div>

            <div class="form-group checkbox-group">
              <label class="toggle-row">
                <input v-model="notificationForm.notifyInvoiceClosed" type="checkbox" />
                <span>Avisar fechamento da fatura</span>
              </label>
              <input v-model.number="notificationForm.daysBeforeInvoiceCloseNotification" type="number" min="1" max="30" />
              <small>Dias antes do fechamento</small>
            </div>

            <div class="form-group checkbox-group">
              <label class="toggle-row">
                <input v-model="notificationForm.notifyCardLimitNearMax" type="checkbox" />
                <span>Avisar limite do cartão alto</span>
              </label>
              <input v-model.number="notificationForm.cardLimitWarningPercentage" type="number" min="1" max="100" />
              <small>Percentual de uso do limite</small>
            </div>

            <div class="form-group checkbox-group">
              <label class="toggle-row">
                <input v-model="notificationForm.notifyUpcomingDebts" type="checkbox" />
                <span>Avisar dívidas próximas</span>
              </label>
              <input v-model.number="notificationForm.daysBeforeDebtDueNotification" type="number" min="1" max="30" />
              <small>Dias antes do vencimento</small>
            </div>

            <div class="form-group checkbox-group full-width">
              <label class="toggle-row">
                <input v-model="notificationForm.notifyUpcomingReceivables" type="checkbox" />
                <span>Avisar receitas próximas</span>
              </label>
              <input v-model.number="notificationForm.daysBeforeReceivableNotification" type="number" min="1" max="30" />
              <small>Dias antes da data esperada</small>
            </div>
          </div>

          <button type="submit" class="btn-primary" :disabled="notificationsLoading">
            {{ notificationsLoading ? 'Salvando...' : 'Salvar preferências' }}
          </button>
        </form>
      </div>

      <div class="card notifications-card">
        <h2>Resumo dos Envios</h2>
        <div v-if="notificationSummary" class="summary-grid">
          <div class="summary-item">
            <strong>{{ notificationSummary.totalSent }}</strong>
            <span>Enviados</span>
          </div>
          <div class="summary-item">
            <strong>{{ notificationSummary.totalFailed }}</strong>
            <span>Falharam</span>
          </div>
          <div class="summary-item">
            <strong>{{ notificationSummary.totalPending }}</strong>
            <span>Pendentes</span>
          </div>
        </div>
        <p class="last-sent">Último envio: {{ formatDateTime(notificationSummary?.lastSentAt ?? null) }}</p>

        <div class="history-list">
          <div v-for="item in notificationHistory" :key="item.id" class="history-item">
            <div>
              <strong>{{ item.subject }}</strong>
              <p>{{ formatDateTime(item.sentAt) }}</p>
            </div>
            <span :class="item.wasSent ? 'status-ok' : 'status-error'">
              {{ item.wasSent ? 'Enviado' : 'Falhou' }}
            </span>
          </div>
          <p v-if="notificationHistory.length === 0" class="empty-note">Nenhum aviso enviado ainda.</p>
        </div>
      </div>

      <!-- Telegram -->
      <div class="card notifications-card">
        <h2>📱 Notificações via Telegram</h2>
        <p class="section-description">Receba alertas de vencimentos e avisos diretamente no Telegram.</p>

        <div v-if="telegramStatus?.isLinked" class="telegram-linked">
          <div class="telegram-info">
            <span class="telegram-badge linked">✅ Vinculado</span>
            <span v-if="telegramStatus.telegramUsername">@{{ telegramStatus.telegramUsername }}</span>
          </div>
          <label class="toggle-row">
            <input
              type="checkbox"
              :checked="telegramStatus.notificationsEnabled"
              @change="toggleTelegram(!telegramStatus!.notificationsEnabled)"
              :disabled="telegramLoading"
            />
            <span>Notificações ativas</span>
          </label>
          <button class="btn-danger-small" @click="unlinkTelegram" :disabled="telegramLoading">
            Desvincular
          </button>
        </div>

        <div v-else class="telegram-unlinked">
          <p>Vincule seu Telegram para receber alertas de boletos, faturas e vencimentos.</p>
          <div v-if="telegramLinkUrl" class="telegram-link-box">
            <p>Clique no link abaixo para vincular:</p>
            <a :href="telegramLinkUrl" target="_blank" class="telegram-link">{{ telegramLinkUrl }}</a>
            <small>O link é de uso único. Após clicar, envie /start no bot.</small>
          </div>
          <button v-else class="btn-primary" @click="generateTelegramLink" :disabled="telegramLoading">
            {{ telegramLoading ? 'Gerando...' : 'Gerar Link de Vinculação' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page { max-width: 900px; margin: 0 auto; }

.page-header { margin-bottom: 2rem; }
.page-header h1 { margin: 0; color: var(--text-primary); }
.page-header p { margin: 0.25rem 0 0; color: var(--text-secondary); }

.alert {
  padding: 1rem 1.25rem;
  border-radius: var(--border-radius);
  margin-bottom: 1.5rem;
  font-weight: 500;
}
.alert-success { background: var(--color-success-bg); color: var(--color-success); }
.alert-error { background: var(--color-danger-bg); color: var(--color-danger); }

.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 1.5rem;
}

.notifications-card {
  grid-column: 1 / -1;
}

.card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: var(--shadow-sm);
  transition: background-color 0.3s ease;
}

.card h2 { margin: 0 0 1.5rem; color: var(--text-primary); font-size: 1.1rem; }

.form-group { margin-bottom: 1.25rem; }
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}
.full-width {
  grid-column: 1 / -1;
}
.form-group label { 
  display: block; 
  margin-bottom: 0.5rem; 
  font-weight: 500; 
  color: var(--text-primary); 
  font-size: 0.9rem; 
}
.form-group input {
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
.form-group input:focus { 
  outline: none; 
  border-color: var(--color-primary); 
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.toggle-row input {
  width: auto;
}

.checkbox-group small,
.section-description,
.last-sent,
.empty-note {
  color: var(--text-secondary);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.summary-item {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  text-align: center;
}

.summary-item strong {
  display: block;
  font-size: 1.4rem;
  color: var(--text-primary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--bg-secondary);
}

.history-item p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
}

.status-ok,
.status-error {
  align-self: center;
  font-weight: 600;
}

.status-ok {
  color: var(--color-success);
}

.status-error {
  color: var(--color-danger);
}

.readonly-group .readonly-value {
  display: block;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  color: var(--text-secondary);
}

.btn-primary {
  width: 100%;
  padding: 0.875rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover:not(:disabled) { 
  background: var(--color-primary-hover);
  transform: translateY(-2px); 
}
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* Responsivo */
@media (max-width: 640px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .card {
    padding: 1.5rem;
  }
}

.telegram-linked {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.telegram-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.telegram-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.telegram-badge.linked {
  background: var(--color-success-bg, rgba(52, 211, 153, 0.1));
  color: var(--color-success, #34d399);
}

.telegram-unlinked p {
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.telegram-link-box {
  background: var(--color-background-soft, #1a1a2e);
  padding: 16px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.telegram-link-box p {
  margin: 0;
  font-size: 0.9rem;
}

.telegram-link {
  color: var(--color-primary, #818cf8);
  word-break: break-all;
  font-weight: 600;
}

.telegram-link-box small {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.btn-danger-small {
  align-self: flex-start;
  padding: 6px 16px;
  background: var(--color-danger-bg, rgba(248, 113, 113, 0.1));
  color: var(--color-danger, #f87171);
  border: 1px solid var(--color-danger, #f87171);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-danger-small:hover {
  background: var(--color-danger, #f87171);
  color: #fff;
}
</style>
