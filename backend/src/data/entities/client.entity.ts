import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from '../../users/entities/user.entity';

@Entity('clients')
@Unique('uq_clients_owner_external_id', ['ownerUserId', 'clientExternalId'])
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_external_id' })
  clientExternalId: string;

  @Column({ name: 'owner_user_id', type: 'int', nullable: true })
  ownerUserId: number | null;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'client_type', nullable: true })
  clientType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Transaction, transaction => transaction.client)
  transactions: Transaction[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;
}
