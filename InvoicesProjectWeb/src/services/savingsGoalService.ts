import api from './api'
import type { SavingsGoal, CreateSavingsGoalDto, UpdateSavingsGoalDto } from '@/types'

export const savingsGoalService = {
  async getAll(): Promise<SavingsGoal[]> {
    const response = await api.get<SavingsGoal[]>('/savingsgoals')
    return response.data
  },

  async getActive(): Promise<SavingsGoal[]> {
    const response = await api.get<SavingsGoal[]>('/savingsgoals/active')
    return response.data
  },

  async getById(id: string): Promise<SavingsGoal> {
    const response = await api.get<SavingsGoal>(`/savingsgoals/${id}`)
    return response.data
  },

  async create(data: CreateSavingsGoalDto): Promise<SavingsGoal> {
    const response = await api.post<SavingsGoal>('/savingsgoals', data)
    return response.data
  },

  async update(id: string, data: UpdateSavingsGoalDto): Promise<SavingsGoal> {
    const response = await api.put<SavingsGoal>(`/savingsgoals/${id}`, data)
    return response.data
  },

  async addAmount(id: string, amount: number): Promise<SavingsGoal> {
    const response = await api.post<SavingsGoal>(`/savingsgoals/${id}/add`, { amount })
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/savingsgoals/${id}`)
  },
}
