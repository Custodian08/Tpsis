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

export interface AnalysisConfigSummary {
  id: number;
  configName: string;
  createdAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  referenceDate: string | null;
  analysisPeriod: number;
  quartilesCount: number;
  scoringMethodVersion: string;
}

export interface AnalysisHistoryItem extends AnalysisConfigSummary {
  clientsAnalyzed: number;
  status: 'completed' | 'incomplete';
}

export interface AnalysisHistoryPage {
  items: AnalysisHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AnalysisClientFilters {
  search: string;
  segmentPattern: string;
  minR: number | null;
  maxR: number | null;
  minF: number | null;
  maxF: number | null;
  minM: number | null;
  maxM: number | null;
}

export interface AnalysisClientScore {
  id: number;
  clientId: number;
  clientExternalId: string;
  fullName: string;
  recencyDays: number;
  frequencyCount: number;
  monetaryValue: number;
  rScore: number;
  fScore: number;
  mScore: number;
  rfmSegment: string;
}

export interface AnalysisSegmentSummary {
  rfmPattern: string;
  rScore: number;
  fScore: number;
  mScore: number;
  segmentName: string;
  clientCount: number;
  clientShare: number;
  monetaryTotal: number;
  monetaryShare: number | null;
  avgMonetary: number;
}

export interface FilteredAnalysisResults {
  analysisConfig: AnalysisConfigSummary;
  filters: AnalysisClientFilters;
  totalClients: number;
  totalMonetary: number;
  page: number;
  pageSize: number;
  totalPages: number;
  segments: AnalysisSegmentSummary[];
  scores: AnalysisClientScore[];
}

export interface AnalysisClientDetail {
  analysisConfig: AnalysisConfigSummary;
  client: Pick<Client, 'id' | 'clientExternalId' | 'fullName' | 'email' | 'phone' | 'clientType'>;
  rfm: {
    recencyDays: number;
    frequencyCount: number;
    monetaryValue: number;
    rScore: number;
    fScore: number;
    mScore: number;
    rfmPattern: string;
    segmentName: string;
  };
  transactions: Array<Pick<Transaction, 'id' | 'transactionDate' | 'amount' | 'itemsCount' | 'paymentMethod'>>;
  transactionsTotal: number;
  transactionsTruncated: boolean;
}

export interface AnalysisResult {
  analysisConfigId: number;
  analysisConfig: AnalysisConfigSummary;
  clientsAnalyzed: number;
  rfmScores: RfmScore[];
  segments: Segment[];
  interpretation: AnalysisInterpretation | null;
}
