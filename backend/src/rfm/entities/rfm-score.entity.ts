import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { AnalysisConfig } from './analysis-config.entity';
import { Segment } from './segment.entity';
import { Client } from '../../data/entities/client.entity';

@Entity('rfm_scores')
export class RfmScore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_id' })
  clientId: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'analysis_config_id' })
  analysisConfigId: number;

  @Column({ name: 'recency_days' })
  recencyDays: number;

  @Column({ name: 'frequency_count' })
  frequencyCount: number;

  @Column({ name: 'monetary_value', type: 'decimal', precision: 10, scale: 2 })
  monetaryValue: number;

  @Column({ name: 'r_score' })
  rScore: number;

  @Column({ name: 'f_score' })
  fScore: number;

  @Column({ name: 'm_score' })
  mScore: number;

  @Column({ name: 'rfm_segment' })
  rfmSegment: string;

  @CreateDateColumn({ name: 'analysis_date' })
  analysisDate: Date;

  @ManyToOne(() => AnalysisConfig, config => config.rfmScores)
  @JoinColumn({ name: 'analysis_config_id' })
  analysisConfig: AnalysisConfig;

  @ManyToMany(() => Segment, segment => segment.rfmScores)
  @JoinTable({
    name: 'segment_rfm_scores',
    joinColumn: { name: 'rfm_score_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'segment_id', referencedColumnName: 'id' }
  })
  segments: Segment[];
}
