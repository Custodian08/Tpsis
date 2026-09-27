import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { RfmScore } from './entities/rfm-score.entity';
import { Segment } from './entities/segment.entity';
import { AnalysisConfig } from './entities/analysis-config.entity';
import { Client } from '../data/entities/client.entity';
import { Transaction } from '../data/entities/transaction.entity';
import { IntelligenceService } from './intelligence.service';

interface AnalyzeDto {
  startDate: string;
  endDate: string;
  quartilesCount?: number;
}

@Injectable()
export class RfmService {
  constructor(
    @InjectRepository(RfmScore)
    private rfmScoreRepository: Repository<RfmScore>,
    @InjectRepository(Segment)
    private segmentRepository: Repository<Segment>,
    @InjectRepository(AnalysisConfig)
    private analysisConfigRepository: Repository<AnalysisConfig>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private readonly intelligenceService: IntelligenceService,
  ) {}

  async analyze(analyzeDto: AnalyzeDto, userId: number) {
    const { startDate, endDate, quartilesCount = 5 } = analyzeDto;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BadRequestException('Дата начала должна быть меньше даты окончания');
    }

    // Get transactions within the period
    const transactions = await this.transactionRepository.find({
      where: {
        transactionDate: Between(start, end),
      },
      relations: ['client'],
    });

    if (transactions.length === 0) {
      throw new BadRequestException('Нет транзакций за указанный период');
    }

    // Calculate RFM metrics for each client
    const clientMetrics = this.calculateClientMetrics(transactions, end);

    // Rank tied values as one group so duplicate metric values do not get
    // split across different RFM scores or collapse into an extreme score.
    const recencyScores = this.calculateScores(
      clientMetrics.map(metric => metric.recency),
      quartilesCount,
      true,
    );
    const frequencyScores = this.calculateScores(
      clientMetrics.map(metric => metric.frequency),
      quartilesCount,
      false,
    );
    const monetaryScores = this.calculateScores(
      clientMetrics.map(metric => metric.monetary),
      quartilesCount,
      false,
    );

    // Create analysis config
    const analysisConfig = this.analysisConfigRepository.create({
      userId,
      configName: `Анализ ${startDate} - ${endDate}`,
      analysisPeriod: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      quartilesCount,
    });
    const savedConfig = await this.analysisConfigRepository.save(analysisConfig);

    // Create or update segments
    const segments = await this.createOrUpdateSegments(quartilesCount);

    // Calculate RFM scores and save results
    const rfmScores = [];
    for (const [index, metric] of clientMetrics.entries()) {
      const rScore = recencyScores[index];
      const fScore = frequencyScores[index];
      const mScore = monetaryScores[index];

      const rfmSegment = `${rScore}${fScore}${mScore}`;

      const rfmScore = this.rfmScoreRepository.create({
        clientId: metric.clientId,
        analysisConfigId: savedConfig.id,
        recencyDays: metric.recency,
        frequencyCount: metric.frequency,
        monetaryValue: metric.monetary,
        rScore,
        fScore,
        mScore,
        rfmSegment,
        analysisDate: new Date(),
      });

      const savedScore = await this.rfmScoreRepository.save(rfmScore);
      
      // Add to corresponding segment
      const segment = segments.find(s => s.rfmPattern === rfmSegment);
      if (segment) {
        // Direct insert into junction table
        await this.rfmScoreRepository
          .createQueryBuilder()
          .relation(RfmScore, "segments")
          .of(savedScore)
          .add(segment);
      }

      rfmScores.push(savedScore);
    }

    const segmentSummaries = await this.buildSegmentSummaries(rfmScores);
    const interpretation = await this.intelligenceService.interpret(
      rfmScores.length,
      quartilesCount,
      segmentSummaries.map(segment => ({
        segmentName: segment.segmentName,
        rfmPattern: segment.rfmPattern,
        clientCount: segment.clientCount,
        avgMonetary: Number(segment.avgMonetary),
      })),
    );
    savedConfig.aiInterpretation = interpretation;
    await this.analysisConfigRepository.save(savedConfig);

    return {
      analysisConfigId: savedConfig.id,
      clientsAnalyzed: rfmScores.length,
      rfmScores: rfmScores.map(score => ({
        clientId: score.clientId,
        rScore: score.rScore,
        fScore: score.fScore,
        mScore: score.mScore,
        rfmSegment: score.rfmSegment,
        recencyDays: score.recencyDays,
        frequencyCount: score.frequencyCount,
        monetaryValue: score.monetaryValue,
      })),
      segments: segmentSummaries,
      interpretation,
    };
  }

  private calculateClientMetrics(transactions: Transaction[], referenceDate: Date) {
    const clientMap = new Map<number, any>();

    for (const transaction of transactions) {
      const clientId = transaction.clientId;

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          clientId,
          recency: Infinity,
          frequency: 0,
          monetary: 0,
          lastTransactionDate: null,
        });
      }

      const metric = clientMap.get(clientId);
      metric.frequency++;
      metric.monetary += parseFloat(transaction.amount.toString());

      const transactionDate = new Date(transaction.transactionDate);
      if (!metric.lastTransactionDate || transactionDate > metric.lastTransactionDate) {
        metric.lastTransactionDate = transactionDate;
      }
    }

    const referenceDay = Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    );
    const metrics = Array.from(clientMap.values()).map(metric => {
      const lastTransactionDate = metric.lastTransactionDate as Date | null;
      const lastTransactionDay = lastTransactionDate
        ? Date.UTC(
            lastTransactionDate.getUTCFullYear(),
            lastTransactionDate.getUTCMonth(),
            lastTransactionDate.getUTCDate(),
          )
        : referenceDay;
      const recency = Math.max(
        0,
        Math.floor((referenceDay - lastTransactionDay) / (1000 * 60 * 60 * 24)),
      );

      return {
        clientId: metric.clientId,
        recency,
        frequency: metric.frequency,
        monetary: metric.monetary,
      };
    });

    return metrics;
  }

  private calculateScores(values: number[], count: number, lowerIsBetter: boolean): number[] {
    if (values.length === 0) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const scoresByValue = new Map<number, number>();
    let groupStart = 0;

    while (groupStart < sorted.length) {
      let groupEnd = groupStart;
      while (groupEnd + 1 < sorted.length && sorted[groupEnd + 1] === sorted[groupStart]) {
        groupEnd += 1;
      }

      // Use the midpoint rank for ties. A single-valued sample receives the
      // neutral middle score instead of an arbitrary best/worst score.
      const percentile = sorted.length === 1
        ? 0.5
        : ((groupStart + groupEnd) / 2) / (sorted.length - 1);
      const orientedPercentile = lowerIsBetter ? 1 - percentile : percentile;
      const score = Math.min(count, Math.floor(orientedPercentile * count) + 1);
      scoresByValue.set(sorted[groupStart], score);
      groupStart = groupEnd + 1;
    }

    return values.map(value => scoresByValue.get(value)!);
  }

  private async createOrUpdateSegments(quartilesCount: number): Promise<Segment[]> {
    const segments = [];
    const totalCombinations = Math.pow(quartilesCount, 3);

    for (let r = 1; r <= quartilesCount; r++) {
      for (let f = 1; f <= quartilesCount; f++) {
        for (let m = 1; m <= quartilesCount; m++) {
          const rfmPattern = `${r}${f}${m}`;
          const segmentName = this.getSegmentName(r, f, m, quartilesCount);

          let segment = await this.segmentRepository.findOne({
            where: { rfmPattern },
          });

          if (!segment) {
            // Check if segment with same name exists (from seed data)
            const existingByName = await this.segmentRepository.findOne({
              where: { segmentName },
            });
            
            if (existingByName) {
              // Update existing segment with new pattern
              existingByName.rfmPattern = rfmPattern;
              existingByName.description = this.getSegmentDescription(r, f, m, quartilesCount);
              segment = await this.segmentRepository.save(existingByName);
            } else {
              // Create new segment
              segment = this.segmentRepository.create({
                segmentName,
                rfmPattern,
                description: this.getSegmentDescription(r, f, m, quartilesCount),
              });
              segment = await this.segmentRepository.save(segment);
            }
          }

          segments.push(segment);
        }
      }
    }

    return segments;
  }

  private getSegmentName(r: number, f: number, m: number, max: number): string {
    const rScore = r >= max - 1 ? 'Высокая' : r <= 2 ? 'Низкая' : 'Средняя';
    const fScore = f >= max - 1 ? 'Высокая' : f <= 2 ? 'Низкая' : 'Средняя';
    const mScore = m >= max - 1 ? 'Высокая' : m <= 2 ? 'Низкая' : 'Средняя';

    return `R${rScore}-F${fScore}-M${mScore} (${r}${f}${m})`;
  }

  private getSegmentDescription(r: number, f: number, m: number, max: number): string {
    if (r >= max - 1 && f >= max - 1 && m >= max - 1) {
      return 'Лояльные клиенты - покупают часто, много и недавно';
    }
    if (r <= 2 && f >= max - 1 && m >= max - 1) {
      return 'Клиенты в зоне риска - покупали часто и много, но давно';
    }
    if (r >= max - 1 && f <= 2 && m >= max - 1) {
      return 'Новые ценные клиенты - недавно начали покупать, но много';
    }
    if (r <= 2 && f <= 2 && m <= 2) {
      return 'Потерянные клиенты - покупали редко, мало и давно';
    }
    return 'Обычный сегмент';
  }

  async getResults(analysisConfigId: number, userId: number) {
    const config = await this.analysisConfigRepository.findOne({
      where: { id: analysisConfigId, userId },
    });

    if (!config) {
      throw new NotFoundException('Анализ не найден');
    }

    const scores = await this.rfmScoreRepository.find({
      where: { analysisConfigId },
      relations: ['client', 'segments'],
    });

    return {
      rfmScores: scores,
      segments: await this.buildSegmentSummaries(scores),
      interpretation: config.aiInterpretation,
    };
  }

  async getSegments(userId: number) {
    const latestConfig = await this.analysisConfigRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!latestConfig) {
      return [];
    }

    const scores = await this.rfmScoreRepository.find({
      where: { analysisConfigId: latestConfig.id },
    });

    return this.buildSegmentSummaries(scores);
  }

  private async buildSegmentSummaries(scores: RfmScore[]) {
    if (scores.length === 0) {
      return [];
    }

    const patterns = [...new Set(scores.map(score => score.rfmSegment))];
    const segments = await this.segmentRepository.find({
      where: { rfmPattern: In(patterns) },
    });

    return segments.map(segment => {
      const segmentScores = scores.filter(score => score.rfmSegment === segment.rfmPattern);
      const totalMonetary = segmentScores.reduce(
        (sum, score) => sum + Number(score.monetaryValue),
        0,
      );

      return {
        ...segment,
        clientCount: segmentScores.length,
        avgMonetary: totalMonetary / segmentScores.length,
      };
    });
  }
}
