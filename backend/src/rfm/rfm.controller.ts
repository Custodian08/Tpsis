import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RfmService } from './rfm.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AnalyzeRfmDto } from './dto/analyze-rfm.dto';
import { AnalysisClientFilterDto, AnalysisHistoryQueryDto } from './dto/analysis-history-query.dto';

@Controller('rfm')
@UseGuards(JwtAuthGuard)
export class RfmController {
  constructor(private readonly rfmService: RfmService) {}

  @Post('analyze')
  analyze(@Body() analyzeDto: AnalyzeRfmDto, @Request() request) {
    return this.rfmService.analyze(analyzeDto, request.user.userId);
  }

  @Get('analyses')
  getAnalysisHistory(@Query() query: AnalysisHistoryQueryDto, @Request() request) {
    return this.rfmService.getAnalysisHistory(query, request.user.userId);
  }

  @Get('results/:configId')
  getResults(@Param('configId') configId: string, @Request() request) {
    return this.rfmService.getResults(+configId, request.user.userId);
  }

  @Get('results/:configId/clients')
  getAnalysisClients(
    @Param('configId', ParseIntPipe) configId: number,
    @Query() query: AnalysisClientFilterDto,
    @Request() request,
  ) {
    return this.rfmService.getAnalysisClients(configId, request.user.userId, query);
  }

  @Get('results/:configId/clients/:clientId')
  getAnalysisClient(
    @Param('configId', ParseIntPipe) configId: number,
    @Param('clientId', ParseIntPipe) clientId: number,
    @Request() request,
  ) {
    return this.rfmService.getAnalysisClient(configId, clientId, request.user.userId);
  }

  @Get('segments')
  getSegments(@Request() request) {
    return this.rfmService.getSegments(request.user.userId);
  }
}
