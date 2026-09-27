import api from './api';
import { AnalyzeDto, AnalysisInterpretation, AnalysisResult, RfmScore, Segment } from '../types';

export const rfmService = {
  async analyze(analyzeDto: AnalyzeDto): Promise<AnalysisResult> {
    const response = await api.post<AnalysisResult>('/rfm/analyze', analyzeDto);
    return response.data;
  },

  async getResults(configId: number): Promise<{
    rfmScores: RfmScore[];
    segments: Segment[];
    interpretation: AnalysisInterpretation | null;
  }> {
    const response = await api.get(`/rfm/results/${configId}`);
    return response.data;
  },

  async getSegments(): Promise<Segment[]> {
    const response = await api.get<Segment[]>('/rfm/segments');
    return response.data;
  },
};
