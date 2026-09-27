import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check(@Res({ passthrough: true }) response: Response) {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        components: { api: 'ok', database: 'ok' },
        checkedAt: new Date().toISOString(),
      };
    } catch {
      response.status(503);
      return {
        status: 'error',
        components: { api: 'ok', database: 'unavailable' },
        checkedAt: new Date().toISOString(),
      };
    }
  }
}
