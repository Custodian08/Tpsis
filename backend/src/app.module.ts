import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DataModule } from './data/data.module';
import { RfmModule } from './rfm/rfm.module';
import { SegmentsModule } from './segments/segments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'rfm_analysis',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // Отключаем автоматическую синхронизацию, используем SQL скрипты
      // Query parameters can include password hashes during account creation.
      logging: false,
    }),
    AuthModule,
    UsersModule,
    DataModule,
    RfmModule,
    SegmentsModule,
  ],
})
export class AppModule {}
