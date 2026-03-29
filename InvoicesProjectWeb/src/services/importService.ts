import api from './api'
import type {
  DocumentExtractionResult,
  ConfirmImportRequest,
  ImportResult,
  BankImportResult,
  ConfirmBankImportRequest,
} from '@/types'

export const importService = {
  // Document OCR
  async extractDocument(file: File): Promise<DocumentExtractionResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<DocumentExtractionResult>('/documentimport/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async confirmDocumentImport(data: ConfirmImportRequest): Promise<ImportResult> {
    const response = await api.post<ImportResult>('/documentimport/confirm', data)
    return response.data
  },

  // Bank OFX
  async importOfx(file: File): Promise<BankImportResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<BankImportResult>('/bankimport/ofx', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Bank CSV
  async importCsv(file: File): Promise<BankImportResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<BankImportResult>('/bankimport/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async confirmBankImport(data: ConfirmBankImportRequest): Promise<ImportResult> {
    const response = await api.post<ImportResult>('/bankimport/confirm', data)
    return response.data
  },
}
