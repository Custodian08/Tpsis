import { Controller, Get, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { SegmentsService } from './segments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('segments')
@UseGuards(JwtAuthGuard)
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  findAll(@Request() request) {
    return this.segmentsService.findAll(request.user.userId);
  }

  @Get('stats')
  getStats(@Request() request) {
    return this.segmentsService.getSegmentStats(request.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() request) {
    return this.segmentsService.findOne(id, request.user.userId);
  }
}
