import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Segment } from '../rfm/entities/segment.entity';
import { AnalysisConfig } from '../rfm/entities/analysis-config.entity';
import { RfmScore } from '../rfm/entities/rfm-score.entity';

@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(Segment)
    private segmentRepository: Repository<Segment>,
    @InjectRepository(AnalysisConfig)
    private analysisConfigRepository: Repository<AnalysisConfig>,
    @InjectRepository(RfmScore)
    private rfmScoreRepository: Repository<RfmScore>,
  ) {}

  async findAll(userId: number) {
    const config = await this.getLatestConfig(userId);
    if (!config) return [];

    const scores = await this.rfmScoreRepository.find({
      where: { analysisConfigId: config.id },
      relations: ['client'],
    });
    return this.summarizeSegments(scores);
  }

  async findOne(id: number, userId: number) {
    const config = await this.getLatestConfig(userId);
    if (!config) throw new NotFoundException('Сегмент не найден');

    const segment = await this.segmentRepository.findOne({ where: { id } });
    if (!segment) throw new NotFoundException('Сегмент не найден');

    const scores = await this.rfmScoreRepository.find({
      where: { analysisConfigId: config.id, rfmSegment: segment.rfmPattern },
      relations: ['client'],
    });
    if (!scores.length) throw new NotFoundException('Сегмент не найден');

    return { ...this.summarizeSegment(segment, scores), rfmScores: scores };
  }

  async getSegmentStats(userId: number) {
    return (await this.findAll(userId)).map(({ rfmScores, ...segment }) => segment);
  }

  private async getLatestConfig(userId: number) {
    return this.analysisConfigRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private async summarizeSegments(scores: RfmScore[]) {
    if (!scores.length) return [];
    const patterns = [...new Set(scores.map(score => score.rfmSegment))];
    const segments = await this.segmentRepository
      .createQueryBuilder('segment')
      .where('segment.rfmPattern IN (:...patterns)', { patterns })
      .getMany();
    return segments.map(segment => {
      const segmentScores = scores.filter(score => score.rfmSegment === segment.rfmPattern);
      return this.summarizeSegment(segment, segmentScores);
    });
  }

  private summarizeSegment(segment: Segment, scores: RfmScore[]) {
    const totalMonetary = scores.reduce((sum, score) => sum + Number(score.monetaryValue), 0);
    return {
      ...segment,
      clientCount: scores.length,
      avgMonetary: scores.length ? totalMonetary / scores.length : 0,
      rfmScores: scores,
    };
  }
}
