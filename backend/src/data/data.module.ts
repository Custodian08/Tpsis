import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { Transaction } from './entities/transaction.entity';
import { DataService } from './data.service';
import { DataController } from './data.controller';
import { RequestThrottleGuard } from '../common/guards/request-throttle.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Transaction])],
  controllers: [DataController],
  providers: [DataService, RequestThrottleGuard],
  exports: [DataService],
})
export class DataModule {}
