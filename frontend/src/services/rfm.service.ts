import api from './api';
import {
  AnalysisClientDetail,
  AnalysisClientFilters,
  AnalysisConfigSummary,
  AnalysisHistoryPage,
  AnalyzeDto,
  AnalysisInterpretation,
  AnalysisResult,
  FilteredAnalysisResults,
  RfmScore,
  Segment,
} from '../types';

export const rfmService = {
  async analyze(analyzeDto: AnalyzeDto): Promise<AnalysisResult> {
    const response = await api.post<AnalysisResult>('/rfm/analyze', analyzeDto);
    return response.data;
  },

  async getAnalysisHistory(params: {
    page?: number;
    pageSize?: number;
    periodStart?: string;
    periodEnd?: string;
  } = {}): Promise<AnalysisHistoryPage> {
    const response = await api.get<AnalysisHistoryPage>('/rfm/analyses', { params });
    return response.data;
  },

  async getResults(configId: number): Promise<{
    analysisConfig: AnalysisConfigSummary;
    rfmScores: RfmScore[];
    segments: Segment[];
    interpretation: AnalysisInterpretation | null;
  }> {
    const response = await api.get(`/rfm/results/${configId}`);
    return response.data;
  },

  async getAnalysisClients(
    configId: number,
    filters: AnalysisClientFilters,
    page = 1,
    pageSize = 25,
  ): Promise<FilteredAnalysisResults> {
    const queryParams: Record<string, string | number> = { page, pageSize };
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        queryParams[key] = value;
      }
    }
    const response = await api.get<FilteredAnalysisResults>(`/rfm/results/${configId}/clients`, {
      params: queryParams,
    });
    return response.data;
  },

  async getAnalysisClient(configId: number, clientId: number): Promise<AnalysisClientDetail> {
    const response = await api.get<AnalysisClientDetail>(
      `/rfm/results/${configId}/clients/${clientId}`,
    );
    return response.data;
  },

  async getSegments(): Promise<Segment[]> {
    const response = await api.get<Segment[]>('/rfm/segments');
    return response.data;
  },
};
