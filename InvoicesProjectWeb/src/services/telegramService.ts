import api from './api'
import type { TelegramLink, TelegramStatus } from '@/types'

export const telegramService = {
  async generateLink(): Promise<TelegramLink> {
    const response = await api.post<TelegramLink>('/telegram/link')
    return response.data
  },

  async getStatus(): Promise<TelegramStatus> {
    const response = await api.get<TelegramStatus>('/telegram/status')
    return response.data
  },

  async toggle(enabled: boolean): Promise<void> {
    await api.post('/telegram/toggle', { enabled })
  },

  async unlink(): Promise<void> {
    await api.delete('/telegram/unlink')
  },
}
