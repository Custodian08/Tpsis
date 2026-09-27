import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource, SelectQueryBuilder } from 'typeorm';
import { RfmScore } from './entities/rfm-score.entity';
import { Segment } from './entities/segment.entity';
import { AnalysisConfig } from './entities/analysis-config.entity';
import { Transaction } from '../data/entities/transaction.entity';
import { IntelligenceService } from './intelligence.service';
import { AnalysisClientFilterDto, AnalysisHistoryQueryDto } from './dto/analysis-history-query.dto';
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

  async getAnalysisHistory(query: AnalysisHistoryQueryDto, userId: number) {
    const periodStart = query.periodStart
      ? this.parseDateOnly(query.periodStart, 'Дата начала фильтра')
      : undefined;
    const periodEnd = query.periodEnd
      ? this.parseDateOnly(query.periodEnd, 'Дата окончания фильтра')
      : undefined;
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new BadRequestException('Дата начала фильтра должна быть раньше даты окончания');
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const historyQuery = this.analysisConfigRepository
      .createQueryBuilder('config')
      .where('config.userId = :userId', { userId });
    if (periodStart) {
      historyQuery.andWhere('config.periodEnd >= :periodStart', {
        periodStart: query.periodStart,
      });
    }
    if (periodEnd) {
      historyQuery.andWhere('config.periodStart <= :periodEnd', {
        periodEnd: query.periodEnd,
      });
    }

    const [configs, total] = await historyQuery
      .orderBy('config.createdAt', 'DESC')
      .addOrderBy('config.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const scoresByConfig = new Map<number, number>();
    if (configs.length) {
      const counts = await this.rfmScoreRepository
        .createQueryBuilder('score')
        .select('score.analysisConfigId', 'configId')
        .addSelect('COUNT(score.id)', 'clientCount')
        .where('score.analysisConfigId IN (:...ids)', { ids: configs.map(config => config.id) })
        .groupBy('score.analysisConfigId')
        .getRawMany();
      counts.forEach(row => scoresByConfig.set(Number(row.configId), Number(row.clientCount)));
    }

    return {
      items: configs.map(config => {
        const clientsAnalyzed = scoresByConfig.get(config.id) || 0;
        return {
          ...this.toPublicConfig(config),
          clientsAnalyzed,
          status: clientsAnalyzed > 0 ? 'completed' : 'incomplete',
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getAnalysisClients(
    analysisConfigId: number,
    userId: number,
    filters: AnalysisClientFilterDto,
  ) {
    const config = await this.analysisConfigRepository.findOne({
      where: { id: analysisConfigId, userId },
    });
    if (!config) throw new NotFoundException('Анализ не найден');

    this.validateClientFilters(filters, config.quartilesCount);
    const filteredQuery = this.buildFilteredScoresQuery(analysisConfigId, filters);
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 25;
    const totalClients = await filteredQuery.clone().getCount();
    const totalMonetaryRow = await filteredQuery
      .clone()
      .select('COALESCE(SUM(score.monetaryValue), 0)', 'totalMonetary')
      .getRawOne();
    const totalMonetary = Number(totalMonetaryRow?.totalMonetary || 0);

    const rawSegments = await filteredQuery
      .clone()
      .select('score.rfmSegment', 'rfmPattern')
      .addSelect('score.rScore', 'rScore')
      .addSelect('score.fScore', 'fScore')
      .addSelect('score.mScore', 'mScore')
      .addSelect('COUNT(score.id)', 'clientCount')
      .addSelect('SUM(score.monetaryValue)', 'monetaryTotal')
      .addSelect('AVG(score.monetaryValue)', 'avgMonetary')
      .groupBy('score.rfmSegment')
      .addGroupBy('score.rScore')
      .addGroupBy('score.fScore')
      .addGroupBy('score.mScore')
      .getRawMany();

    const segments = rawSegments
      .map(row => {
        const clientCount = Number(row.clientCount);
        const monetaryTotal = Number(row.monetaryTotal);
        return {
          rfmPattern: row.rfmPattern,
          segmentName: getSegmentName(
            Number(row.rScore),
            Number(row.fScore),
            Number(row.mScore),
            config.quartilesCount,
          ),
          clientCount,
          clientShare: totalClients ? Number(((clientCount / totalClients) * 100).toFixed(1)) : 0,
          monetaryTotal,
          monetaryShare: totalMonetary > 0
            ? Number(((monetaryTotal / totalMonetary) * 100).toFixed(1))
            : null,
          avgMonetary: Number(row.avgMonetary),
        };
      })
      .sort((a, b) => b.clientCount - a.clientCount);

    const scores = await filteredQuery
      .clone()
      .orderBy('client.fullName', 'ASC', 'NULLS LAST')
      .addOrderBy('client.clientExternalId', 'ASC')
      .addOrderBy('score.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      analysisConfig: this.toPublicConfig(config),
      filters: this.toPublicFilters(filters),
      totalClients,
      totalMonetary,
      page,
      pageSize,
      totalPages: Math.ceil(totalClients / pageSize),
      segments,
      scores: scores.map(score => ({
        id: score.id,
        clientId: score.clientId,
        clientExternalId: score.client?.clientExternalId || '',
        fullName: score.client?.fullName || '',
        recencyDays: score.recencyDays,
        frequencyCount: score.frequencyCount,
        monetaryValue: Number(score.monetaryValue),
        rScore: score.rScore,
        fScore: score.fScore,
        mScore: score.mScore,
        rfmSegment: score.rfmSegment,
      })),
    };
  }

  async getAnalysisClient(analysisConfigId: number, clientId: number, userId: number) {
    const config = await this.analysisConfigRepository.findOne({
      where: { id: analysisConfigId, userId },
    });
    if (!config) throw new NotFoundException('Анализ не найден');

    const score = await this.rfmScoreRepository.findOne({
      where: { analysisConfigId, clientId },
      relations: ['client'],
    });
    if (!score) throw new NotFoundException('Клиент не найден в выбранном анализе');

    let transactions: Transaction[] = [];
    let transactionsTotal = 0;
    if (config.periodStart && config.periodEnd) {
      const where = {
        clientId,
        transactionDate: Between(
          this.parseDateOnly(config.periodStart, 'Дата начала анализа'),
          this.parseDateOnly(config.periodEnd, 'Дата окончания анализа'),
        ),
      };
      transactionsTotal = await this.transactionRepository.count({ where });
      transactions = await this.transactionRepository.find({
        where,
        order: { transactionDate: 'DESC', id: 'DESC' },
        take: 100,
      });
    }

    return {
      analysisConfig: this.toPublicConfig(config),
      client: {
        id: score.client.id,
        clientExternalId: score.client.clientExternalId,
        fullName: score.client.fullName,
        email: score.client.email,
        phone: score.client.phone,
        clientType: score.client.clientType,
      },
      rfm: {
        recencyDays: score.recencyDays,
        frequencyCount: score.frequencyCount,
        monetaryValue: Number(score.monetaryValue),
        rScore: score.rScore,
        fScore: score.fScore,
        mScore: score.mScore,
        rfmPattern: score.rfmSegment,
        segmentName: getSegmentName(score.rScore, score.fScore, score.mScore, config.quartilesCount),
      },
      transactions: transactions.map(transaction => ({
        id: transaction.id,
        transactionDate: transaction.transactionDate,
        amount: Number(transaction.amount),
        itemsCount: transaction.itemsCount,
        paymentMethod: transaction.paymentMethod,
      })),
      transactionsTotal,
      transactionsTruncated: transactionsTotal > transactions.length,
    };
  }

  private buildFilteredScoresQuery(
    analysisConfigId: number,
    filters: AnalysisClientFilterDto,
  ): SelectQueryBuilder<RfmScore> {
    const query = this.rfmScoreRepository
      .createQueryBuilder('score')
      .innerJoinAndSelect('score.client', 'client')
      .where('score.analysisConfigId = :analysisConfigId', { analysisConfigId });

    if (filters.segmentPattern) {
      query.andWhere('score.rfmSegment = :segmentPattern', { segmentPattern: filters.segmentPattern });
    }
    for (const [key, column] of [
      ['minR', 'score.rScore'], ['maxR', 'score.rScore'],
      ['minF', 'score.fScore'], ['maxF', 'score.fScore'],
      ['minM', 'score.mScore'], ['maxM', 'score.mScore'],
    ] as const) {
      const value = filters[key];
      if (value !== undefined) {
        const operator = key.startsWith('min') ? '>=' : '<=';
        query.andWhere(`${column} ${operator} :${key}`, { [key]: value });
      }
    }
    const search = filters.search?.trim();
    if (search) {
      query.andWhere(
        '(client.fullName ILIKE :search OR client.clientExternalId ILIKE :search OR client.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    return query;
  }

  private validateClientFilters(filters: AnalysisClientFilterDto, quartilesCount: number) {
    for (const dimension of ['R', 'F', 'M'] as const) {
      const minimum = filters[`min${dimension}`];
      const maximum = filters[`max${dimension}`];
      if ((minimum !== undefined && minimum > quartilesCount) ||
        (maximum !== undefined && maximum > quartilesCount)) {
        throw new BadRequestException(`Оценка ${dimension} не может превышать ${quartilesCount}`);
      }
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        throw new BadRequestException(`Минимальная оценка ${dimension} больше максимальной`);
      }
    }
  }

  private toPublicFilters(filters: AnalysisClientFilterDto) {
    return {
      search: filters.search || '',
      segmentPattern: filters.segmentPattern || '',
      minR: filters.minR ?? null,
      maxR: filters.maxR ?? null,
      minF: filters.minF ?? null,
      maxF: filters.maxF ?? null,
      minM: filters.minM ?? null,
      maxM: filters.maxM ?? null,
    };
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
      createdAt: config.createdAt,
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
