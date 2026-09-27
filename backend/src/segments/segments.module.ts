import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Segment } from '../rfm/entities/segment.entity';
import { AnalysisConfig } from '../rfm/entities/analysis-config.entity';
import { RfmScore } from '../rfm/entities/rfm-score.entity';
import { SegmentsService } from './segments.service';
import { SegmentsController } from './segments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Segment, AnalysisConfig, RfmScore])],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
