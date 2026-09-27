import api from './api';
import { Client, Transaction, ImportResult, PaginatedResponse } from '../types';

export const dataService = {
  async importCSV(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ImportResult>('/data/import/csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async importExcel(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ImportResult>('/data/import/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getClients(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<PaginatedResponse<Client>> {
    const response = await api.get<PaginatedResponse<Client>>('/data/clients', { params });
    return response.data;
  },

  async getTransactions(params: { page?: number; pageSize?: number; search?: string; clientId?: number; dateFrom?: string; dateTo?: string } = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await api.get<PaginatedResponse<Transaction>>('/data/transactions', { params });
    return response.data;
  },

  async getStats() {
    const response = await api.get('/data/stats');
    return response.data;
  },
};
