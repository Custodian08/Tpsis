import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SegmentForInterpretation {
  segmentName: string;
  rfmPattern: string;
  clientCount: number;
  avgMonetary: number;
}

export interface AnalysisInterpretation {
  status: 'available' | 'unavailable';
  summary: string;
  insights: string[];
  recommendations: string[];
}

@Injectable()
export class IntelligenceService {
  constructor(private readonly configService: ConfigService) {}

  async interpret(
    totalClients: number,
    quartilesCount: number,
    segments: SegmentForInterpretation[],
  ): Promise<AnalysisInterpretation> {
    const serviceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://127.0.0.1:8001',
    );

    try {
      const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalClients, quartilesCount, segments }),
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error(`AI service returned ${response.status}`);

      const result = await response.json();
      if (
        !result ||
        typeof result.summary !== 'string' ||
        !Array.isArray(result.insights) ||
        !Array.isArray(result.recommendations) ||
        !result.insights.every(item => typeof item === 'string') ||
        !result.recommendations.every(item => typeof item === 'string')
      ) {
        throw new Error('AI service returned an invalid response');
      }

      return {
        status: 'available',
        summary: result.summary.slice(0, 2000),
        insights: result.insights.slice(0, 20).map(item => item.slice(0, 500)),
        recommendations: result.recommendations.slice(0, 20).map(item => item.slice(0, 500)),
      };
    } catch {
      return {
        status: 'unavailable',
        summary: 'Интеллектуальная интерпретация сейчас недоступна. Числовые результаты RFM-анализа сохранены.',
        insights: [],
        recommendations: [],
      };
    }
  }
}
