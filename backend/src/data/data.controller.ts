import { Controller, Post, Get, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataService } from './data.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestThrottleGuard } from '../common/guards/request-throttle.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Controller('data')
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post('import/csv')
  @UseGuards(RequestThrottleGuard)
  @RateLimit(20, 60 * 60 * 1000)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  async importCSV(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }
    return this.dataService.importFromCSV(file);
  }

  @Post('import/excel')
  @UseGuards(RequestThrottleGuard)
  @RateLimit(20, 60 * 60 * 1000)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }
    return this.dataService.importFromExcel(file);
  }

  @Get('clients')
  getClients() {
    return this.dataService.getClients();
  }

  @Get('transactions')
  getTransactions() {
    return this.dataService.getTransactions();
  }

  @Get('stats')
  getStats() {
    return this.dataService.getClientStats();
  }
}
