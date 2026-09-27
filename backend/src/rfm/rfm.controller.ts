import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RfmService } from './rfm.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AnalyzeRfmDto } from './dto/analyze-rfm.dto';

@Controller('rfm')
@UseGuards(JwtAuthGuard)
export class RfmController {
  constructor(private readonly rfmService: RfmService) {}

  @Post('analyze')
  analyze(@Body() analyzeDto: AnalyzeRfmDto, @Request() request) {
    return this.rfmService.analyze(analyzeDto, request.user.userId);
  }

  @Get('results/:configId')
  getResults(@Param('configId') configId: string, @Request() request) {
    return this.rfmService.getResults(+configId, request.user.userId);
  }

  @Get('segments')
  getSegments(@Request() request) {
    return this.rfmService.getSegments(request.user.userId);
  }
}
