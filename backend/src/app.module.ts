import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DataModule } from './data/data.module';
import { RfmModule } from './rfm/rfm.module';
import { SegmentsModule } from './segments/segments.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        const jwtSecret = config.JWT_SECRET?.trim();
        if (!jwtSecret || jwtSecret.length < 32 || /^(your-|change-|replace-)/i.test(jwtSecret)) {
          throw new Error('JWT_SECRET must be a randomly generated secret of at least 32 characters.');
        }
        for (const variable of ['DB_PORT', 'PORT']) {
          const value = config[variable];
          if (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) {
            throw new Error(`${variable} must be an integer between 1 and 65535.`);
          }
        }
        if (config.NODE_ENV === 'production' && !config.DB_PASSWORD) {
          throw new Error('DB_PASSWORD must be configured in production.');
        }
        return config;
      },
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
  controllers: [HealthController],
})
export class AppModule {}
