import { ref } from 'vue'
import type { PurchasePlan } from '@/types'

const plan = ref<PurchasePlan | null>(null)

export function usePurchasePlan() {
  function setPlan(data: PurchasePlan) {
    plan.value = data
    sessionStorage.setItem('purchasePlan', JSON.stringify(data))
  }

  function loadFromStorage() {
    if (!plan.value) {
      const stored = sessionStorage.getItem('purchasePlan')
      if (stored) {
        plan.value = JSON.parse(stored)
      }
    }
  }

  loadFromStorage()

  return { plan, setPlan }
}
