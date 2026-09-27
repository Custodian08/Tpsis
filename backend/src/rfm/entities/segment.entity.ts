import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { RfmScore } from './rfm-score.entity';

@Entity('segments')
export class Segment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'segment_name', unique: true })
  segmentName: string;

  @Column({ name: 'rfm_pattern' })
  rfmPattern: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'client_count', default: 0 })
  clientCount: number;

  @Column({ name: 'avg_monetary', type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgMonetary: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToMany(() => RfmScore, rfmScore => rfmScore.segments)
  @JoinTable({
    name: 'segment_rfm_scores',
    joinColumn: { name: 'segment_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'rfm_score_id', referencedColumnName: 'id' }
  })
  rfmScores: RfmScore[];
}