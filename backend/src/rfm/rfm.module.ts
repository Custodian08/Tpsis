import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RfmScore } from './entities/rfm-score.entity';
import { Segment } from './entities/segment.entity';
import { AnalysisConfig } from './entities/analysis-config.entity';
import { Client } from '../data/entities/client.entity';
import { Transaction } from '../data/entities/transaction.entity';
import { RfmService } from './rfm.service';
import { RfmController } from './rfm.controller';
import { IntelligenceService } from './intelligence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RfmScore, Segment, AnalysisConfig, Client, Transaction]),
  ],
  controllers: [RfmController],
  providers: [RfmService, IntelligenceService],
  exports: [RfmService],
})
export class RfmModule {}
