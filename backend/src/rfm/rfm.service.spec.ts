import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AnalysisConfig } from './entities/analysis-config.entity';
import { IntelligenceService } from './intelligence.service';
import { RfmService } from './rfm.service';
import { RfmScore } from './entities/rfm-score.entity';
import { Segment } from './entities/segment.entity';
import { Transaction } from '../data/entities/transaction.entity';

describe('RfmService access control', () => {
  it('does not return an analysis owned by another user', async () => {
    const analysisConfigs = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new RfmService(
      {} as Repository<RfmScore>,
      {} as Repository<Segment>,
      analysisConfigs as unknown as Repository<AnalysisConfig>,
      {} as Repository<Transaction>,
      {} as DataSource,
      {} as IntelligenceService,
    );

    await expect(service.getResults(41, 7)).rejects.toThrow(NotFoundException);
    expect(analysisConfigs.findOne).toHaveBeenCalledWith({ where: { id: 41, userId: 7 } });
  });
});
