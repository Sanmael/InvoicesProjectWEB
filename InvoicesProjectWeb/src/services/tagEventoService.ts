import api from './api'
import type { TagEvento, CreateTagEventoDto, UpdateTagEventoDto } from '@/types'

export const tagEventoService = {
  async getAll(): Promise<TagEvento[]> {
    const response = await api.get<TagEvento[]>('/tagevento')
    return response.data
  },

  async getById(id: string): Promise<TagEvento> {
    const response = await api.get<TagEvento>(`/tagevento/${id}`)
    return response.data
  },

  async create(data: CreateTagEventoDto): Promise<TagEvento> {
    const response = await api.post<TagEvento>('/tagevento', data)
    return response.data
  },

  async update(id: string, data: UpdateTagEventoDto): Promise<TagEvento> {
    const response = await api.put<TagEvento>(`/tagevento/${id}`, data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/tagevento/${id}`)
  },
}
