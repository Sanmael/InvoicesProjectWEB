import api from './api'
import type { ChatRequest, ChatResponse } from '@/types'

export const chatService = {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/chat', request)
    return response.data
  },
}
