import api from './api'
import type { PurchaseSimulationRequest, PurchaseSimulationResult } from '@/types'

export const purchaseSimulationService = {
  async simulate(data: PurchaseSimulationRequest): Promise<PurchaseSimulationResult> {
    const response = await api.post<PurchaseSimulationResult>('/purchasesimulation/simulate', data)
    return response.data
  },
}
