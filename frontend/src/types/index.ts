export interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Client {
  id: number;
  clientExternalId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  clientType: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  clientId: number;
  transactionDate: string;
  amount: number;
  itemsCount: number;
  paymentMethod: string | null;
  createdAt: string;
}

export interface ImportResult {
  clientsImported: number;
  transactionsImported: number;
  errors: number;
}

export interface AnalyzeDto {
  startDate: string;
  endDate: string;
  quartilesCount?: number;
}

export interface RfmScore {
  id: number;
  clientId: number;
  analysisConfigId: number;
  recencyDays: number;
  frequencyCount: number;
  monetaryValue: number;
  rScore: number;
  fScore: number;
  mScore: number;
  rfmSegment: string;
  analysisDate: string;
}

export interface Segment {
  id: number;
  segmentName: string;
  rfmPattern: string;
  description: string | null;
  clientCount: number;
  avgMonetary: number;
  createdAt: string;
}

export interface AnalysisInterpretation {
  status: 'available' | 'unavailable';
  summary: string;
  insights: string[];
  recommendations: string[];
}

export interface AnalysisResult {
  analysisConfigId: number;
  analysisConfig: {
    id: number;
    configName: string;
    periodStart: string | null;
    periodEnd: string | null;
    referenceDate: string | null;
    analysisPeriod: number;
    quartilesCount: number;
    scoringMethodVersion: string;
  };
  clientsAnalyzed: number;
  rfmScores: RfmScore[];
  segments: Segment[];
  interpretation: AnalysisInterpretation | null;
}
