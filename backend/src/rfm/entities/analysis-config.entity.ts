import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { RfmScore } from './rfm-score.entity';

@Entity('analysis_configs')
export class AnalysisConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'config_name' })
  configName: string;

  @Column({ name: 'analysis_period' })
  analysisPeriod: number;

  @Column({ name: 'quartiles_count', default: 5 })
  quartilesCount: number;

  @Column({ name: 'r_weights', type: 'json', nullable: true })
  rWeights: number[];

  @Column({ name: 'f_weights', type: 'json', nullable: true })
  fWeights: number[];

  @Column({ name: 'm_weights', type: 'json', nullable: true })
  mWeights: number[];

  @Column({ name: 'ai_interpretation', type: 'jsonb', nullable: true })
  aiInterpretation: {
    status: 'available' | 'unavailable';
    summary: string;
    insights: string[];
    recommendations: string[];
  } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => RfmScore, rfmScore => rfmScore.analysisConfig)
  rfmScores: RfmScore[];
}
