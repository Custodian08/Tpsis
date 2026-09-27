import api from './api';
import { Client, Transaction, ImportResult } from '../types';

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

  async getClients(): Promise<Client[]> {
    const response = await api.get<Client[]>('/data/clients');
    return response.data;
  },

  async getTransactions(): Promise<Transaction[]> {
    const response = await api.get<Transaction[]>('/data/transactions');
    return response.data;
  },

  async getStats() {
    const response = await api.get('/data/stats');
    return response.data;
  },
};