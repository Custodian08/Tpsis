import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource } from 'typeorm';
import { RfmScore } from './entities/rfm-score.entity';
import { Segment } from './entities/segment.entity';
import { AnalysisConfig } from './entities/analysis-config.entity';
import { Transaction } from '../data/entities/transaction.entity';
import { IntelligenceService } from './intelligence.service';
import {
  calculateClientMetrics,
  calculateRankScores,
  getInclusivePeriodDays,
  getScoreLevel,
  getSegmentName,
  parseUtcCalendarDate,
  RFM_SCORING_METHOD_VERSION,
} from './rfm-rules';

interface AnalyzeDto {
  startDate: string;
  endDate: string;
  quartilesCount?: number;
}

const MAX_ANALYSIS_TRANSACTIONS = 100_000;

@Injectable()
export class RfmService {
  constructor(
    @InjectRepository(RfmScore)
    private rfmScoreRepository: Repository<RfmScore>,
    @InjectRepository(Segment)
    private segmentRepository: Repository<Segment>,
    @InjectRepository(AnalysisConfig)
    private analysisConfigRepository: Repository<AnalysisConfig>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly intelligenceService: IntelligenceService,
  ) {}

  async analyze(analyzeDto: AnalyzeDto, userId: number) {
    const { startDate, endDate, quartilesCount = 5 } = analyzeDto;

    const start = this.parseDateOnly(startDate, 'Дата начала');
    const end = this.parseDateOnly(endDate, 'Дата окончания');
    const analysisPeriod = getInclusivePeriodDays(start, end);
    if (analysisPeriod === null) {
      throw new BadRequestException('Дата начала должна быть меньше даты окончания');
    }

    const transactions = await this.transactionRepository.find({
      where: {
        transactionDate: Between(start, end),
      },
      relations: ['client'],
      take: MAX_ANALYSIS_TRANSACTIONS + 1,
    });

    if (transactions.length > MAX_ANALYSIS_TRANSACTIONS) {
      throw new BadRequestException(
        `За период найдено более ${MAX_ANALYSIS_TRANSACTIONS} транзакций. Уточните период анализа.`,
      );
    }

    if (transactions.length === 0) {
      throw new BadRequestException('Нет транзакций за указанный период');
    }

    // Calculate RFM metrics for each client
    const clientMetrics = calculateClientMetrics(transactions, end);

    // Rank tied values as one group so duplicate metric values do not get
    // split across different RFM scores or collapse into an extreme score.
    const recencyScores = calculateRankScores(
      clientMetrics.map(metric => metric.recency),
      quartilesCount,
      true,
    );
    const frequencyScores = calculateRankScores(
      clientMetrics.map(metric => metric.frequency),
      quartilesCount,
      false,
    );
    const monetaryScores = calculateRankScores(
      clientMetrics.map(metric => metric.monetary),
      quartilesCount,
      false,
    );

    // Ensure only observed segment patterns are present in the shared catalog.
    const patterns = [...new Set(clientMetrics.map((_, index) =>
      `${recencyScores[index]}${frequencyScores[index]}${monetaryScores[index]}`,
    ))];
    const segments = await this.createOrUpdateSegments(patterns);

    // Persist configuration, client scores and their segment links atomically.
    const { savedConfig, rfmScores } = await this.dataSource.transaction(async manager => {
      const configRepository = manager.getRepository(AnalysisConfig);
      const scoreRepository = manager.getRepository(RfmScore);
      const analysisConfig = configRepository.create({
        userId,
        configName: `Анализ ${startDate} - ${endDate}`,
        analysisPeriod,
        periodStart: startDate,
        periodEnd: endDate,
        referenceDate: endDate,
        quartilesCount,
        scoringMethodVersion: RFM_SCORING_METHOD_VERSION,
      });
      const config = await configRepository.save(analysisConfig);
      const scoreEntities = clientMetrics.map((metric, index) => {
        const rScore = recencyScores[index];
        const fScore = frequencyScores[index];
        const mScore = monetaryScores[index];
        return scoreRepository.create({
          clientId: metric.clientId,
          analysisConfigId: config.id,
          recencyDays: metric.recency,
          frequencyCount: metric.frequency,
          monetaryValue: metric.monetary,
          rScore,
          fScore,
          mScore,
          rfmSegment: `${rScore}${fScore}${mScore}`,
          analysisDate: new Date(),
        });
      });
      const savedScores = await scoreRepository.save(scoreEntities, { chunk: 500 });

      const scoresByPattern = new Map<string, RfmScore[]>();
      for (const score of savedScores) {
        const grouped = scoresByPattern.get(score.rfmSegment) || [];
        grouped.push(score);
        scoresByPattern.set(score.rfmSegment, grouped);
      }
      for (const [pattern, groupedScores] of scoresByPattern) {
        const segment = segments.find(item => item.rfmPattern === pattern);
        if (!segment) continue;
        await scoreRepository
          .createQueryBuilder()
          .relation(RfmScore, 'segments')
          .of(groupedScores)
          .add(segment);
      }

      return { savedConfig: config, rfmScores: savedScores };
    });

    const segmentSummaries = await this.buildSegmentSummaries(rfmScores, quartilesCount);
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
      analysisConfig: this.toPublicConfig(savedConfig),
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

  private parseDateOnly(value: string, label: string): Date {
    const date = parseUtcCalendarDate(value);
    if (!date) {
      throw new BadRequestException(`${label} должна быть существующей датой в формате ГГГГ-ММ-ДД`);
    }
    return date;
  }

  private async createOrUpdateSegments(patterns: string[]): Promise<Segment[]> {
    const segments = [];
    for (const rfmPattern of patterns) {
      let segment = await this.segmentRepository.findOne({ where: { rfmPattern } });
      if (!segment) {
        segment = this.segmentRepository.create({
          segmentName: `RFM pattern (${rfmPattern})`,
          rfmPattern,
          description: 'Уровни сегмента определяются числом квантилей конкретного анализа.',
        });
        segment = await this.segmentRepository.save(segment);
      }
      segments.push(segment);
    }

    return segments;
  }

  private getSegmentDescription(r: number, f: number, m: number, max: number): string {
    const rLevel = getScoreLevel(r, max);
    const fLevel = getScoreLevel(f, max);
    const mLevel = getScoreLevel(m, max);
    if (rLevel === 'high' && fLevel === 'high' && mLevel === 'high') {
      return 'Лояльные клиенты - покупают часто, много и недавно';
    }
    if (rLevel === 'low' && fLevel === 'high' && mLevel === 'high') {
      return 'Клиенты в зоне риска - покупали часто и много, но давно';
    }
    if (rLevel === 'high' && fLevel === 'low' && mLevel === 'high') {
      return 'Новые ценные клиенты - недавно начали покупать, но много';
    }
    if (rLevel === 'low' && fLevel === 'low' && mLevel === 'low') {
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
      analysisConfig: this.toPublicConfig(config),
      rfmScores: scores,
      segments: await this.buildSegmentSummaries(scores, config.quartilesCount),
      interpretation: config.aiInterpretation,
    };
  }

  private toPublicConfig(config: AnalysisConfig) {
    return {
      id: config.id,
      configName: config.configName,
      periodStart: config.periodStart,
      periodEnd: config.periodEnd,
      referenceDate: config.referenceDate,
      analysisPeriod: config.analysisPeriod,
      quartilesCount: config.quartilesCount,
      scoringMethodVersion: config.scoringMethodVersion,
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

    return this.buildSegmentSummaries(scores, latestConfig.quartilesCount);
  }

  private async buildSegmentSummaries(scores: RfmScore[], quartilesCount: number) {
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
      const representative = segmentScores[0];

      return {
        ...segment,
        segmentName: getSegmentName(
          representative.rScore,
          representative.fScore,
          representative.mScore,
          quartilesCount,
        ),
        description: this.getSegmentDescription(
          representative.rScore,
          representative.fScore,
          representative.mScore,
          quartilesCount,
        ),
        clientCount: segmentScores.length,
        avgMonetary: totalMonetary / segmentScores.length,
      };
    });
  }
}
