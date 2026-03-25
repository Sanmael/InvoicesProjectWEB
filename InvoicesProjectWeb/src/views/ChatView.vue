<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { chatService } from '@/services/chatService'
import type { ChatMessage } from '@/types'

const messages = ref<ChatMessage[]>([])
const input = ref('')
const loading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const response = await chatService.sendMessage({
      message: text,
      history: messages.value.slice(0, -1),
    })

    messages.value.push({ role: 'assistant', content: response.reply })
  } catch {
    messages.value.push({
      role: 'assistant',
      content: '❌ Erro ao processar mensagem. Tente novamente.',
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function clearChat() {
  messages.value = []
}
</script>

<template>
  <div class="chat-page">
    <header class="page-header">
      <div>
        <h1>💬 Kash Chat</h1>
        <p>Gerencie suas finanças por conversa</p>
      </div>
      <button v-if="messages.length > 0" @click="clearChat" class="btn-secondary">Limpar conversa</button>
    </header>

    <div class="chat-container">
      <div ref="messagesContainer" class="chat-messages">
        <div v-if="messages.length === 0" class="chat-empty">
          <div class="chat-empty-icon">🤖</div>
          <h3>Olá! Sou o Kash.</h3>
          <p>Posso te ajudar a gerenciar débitos, recebíveis, cartões e compras. Experimente:</p>
          <div class="suggestions">
            <button @click="input = 'Cria um débito de R$200 de conta de luz vencendo dia 15'" class="suggestion-chip">
              💡 Conta de luz R$200, dia 15
            </button>
            <button @click="input = 'Cria um débito recorrente de R$100 de ajuda familiar todo dia 5, por 12 meses'" class="suggestion-chip">
              💡 Débito recorrente 12x
            </button>
            <button @click="input = 'Cadastra meu cartão Nubank final 1234, fecha dia 3, vence dia 10'" class="suggestion-chip">
              💡 Cadastrar cartão
            </button>
            <button @click="input = 'Quais meus débitos pendentes?'" class="suggestion-chip">
              💡 Listar débitos pendentes
            </button>
          </div>
        </div>

        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="chat-bubble"
          :class="msg.role"
        >
          <div class="bubble-avatar">
            {{ msg.role === 'user' ? '👤' : '🤖' }}
          </div>
          <div class="bubble-content">
            <span class="bubble-text">{{ msg.content }}</span>
          </div>
        </div>

        <div v-if="loading" class="chat-bubble assistant">
          <div class="bubble-avatar">🤖</div>
          <div class="bubble-content">
            <span class="typing-indicator">
              <span></span><span></span><span></span>
            </span>
          </div>
        </div>
      </div>

      <form @submit.prevent="sendMessage" class="chat-input-bar">
        <textarea
          v-model="input"
          @keydown="handleKeydown"
          placeholder="Ex: cria débito de 150 reais, conta de internet, vence dia 20..."
          rows="1"
          :disabled="loading"
        ></textarea>
        <button type="submit" :disabled="!input.trim() || loading" class="send-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  max-width: 800px;
  margin: 0 auto;
  height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-shrink: 0;
}
.page-header h1 { margin: 0; color: var(--text-primary); }
.page-header p { margin: 0.25rem 0 0; color: var(--text-secondary); }

.btn-secondary {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--input-border);
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-secondary:hover { background: var(--hover-bg); }

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-height: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  color: var(--text-secondary);
}
.chat-empty-icon { font-size: 3rem; margin-bottom: 0.5rem; }
.chat-empty h3 { margin: 0; color: var(--text-primary); }
.chat-empty p { margin: 0.5rem 0 1rem; }

.suggestions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
.suggestion-chip {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--input-border);
  border-radius: 2rem;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.suggestion-chip:hover {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
}

.chat-bubble {
  display: flex;
  gap: 0.75rem;
  max-width: 85%;
  animation: fadeIn 0.2s ease;
}
.chat-bubble.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.chat-bubble.assistant {
  align-self: flex-start;
}

.bubble-avatar {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}

.bubble-content {
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  line-height: 1.5;
}
.chat-bubble.user .bubble-content {
  background: var(--color-primary);
  color: white;
  border-bottom-right-radius: 0.25rem;
}
.chat-bubble.assistant .bubble-content {
  background: var(--bg-primary);
  color: var(--text-primary);
  border-bottom-left-radius: 0.25rem;
}

.bubble-text { white-space: pre-wrap; word-break: break-word; }

/* Typing indicator */
.typing-indicator {
  display: flex;
  gap: 0.3rem;
  padding: 0.25rem 0;
}
.typing-indicator span {
  width: 0.5rem;
  height: 0.5rem;
  background: var(--text-muted);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}
.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: translateY(0); }
}

/* Input bar */
.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--input-border);
}
.chat-input-bar textarea {
  flex: 1;
  resize: none;
  padding: 0.75rem 1rem;
  border: 1px solid var(--input-border);
  border-radius: var(--border-radius);
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.4;
  max-height: 6rem;
  overflow-y: auto;
}
.chat-input-bar textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.send-btn {
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}
.send-btn:hover:not(:disabled) { transform: scale(1.05); background: var(--color-primary-hover); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 768px) {
  .chat-page { height: calc(100vh - 4rem); }
  .chat-bubble { max-width: 92%; }
  .suggestions { flex-direction: column; }
}
</style>
