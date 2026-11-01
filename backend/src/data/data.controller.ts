import { Controller, Post, Get, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Query, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataService } from './data.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestThrottleGuard } from '../common/guards/request-throttle.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { DataQueryDto } from './dto/data-query.dto';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Controller('data')
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post('import/csv/preview')
  @UseGuards(RequestThrottleGuard)
  @RateLimit(20, 60 * 60 * 1000)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 0 },
    }),
  )
  async previewCSV(@UploadedFile() file: Express.Multer.File, @Request() request) {
    if (!file) throw new BadRequestException('Файл не загружен');
    return this.dataService.previewFromCSV(file, request.user.userId);
  }

  @Post('import/excel/preview')
  @UseGuards(RequestThrottleGuard)
  @RateLimit(20, 60 * 60 * 1000)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 0 },
    }),
  )
  async previewExcel(@UploadedFile() file: Express.Multer.File, @Request() request) {
    if (!file) throw new BadRequestException('Файл не загружен');
    return this.dataService.previewFromExcel(file, request.user.userId);
  }

  @Post('import/csv')
  @UseGuards(RequestThrottleGuard)
  @RateLimit(20, 60 * 60 * 1000)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 0 },
    }),
  )
  async importCSV(@UploadedFile() file: Express.Multer.File, @Request() request) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }
    return this.dataService.importFromCSV(file, request.user.userId);
  }

  @Post('import/excel')
  @UseGuards(RequestThrottleGuard)
  @RateLimit(20, 60 * 60 * 1000)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 0 },
    }),
  )
  async importExcel(@UploadedFile() file: Express.Multer.File, @Request() request) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }
    return this.dataService.importFromExcel(file, request.user.userId);
  }

  @Get('clients')
  getClients(@Query() query: DataQueryDto, @Request() request) {
    return this.dataService.getClients(query, request.user.userId);
  }

  @Get('transactions')
  getTransactions(@Query() query: DataQueryDto, @Request() request) {
    return this.dataService.getTransactions(query, request.user.userId);
  }

  @Get('stats')
  getStats(@Request() request) {
    return this.dataService.getClientStats(request.user.userId);
  }
}
