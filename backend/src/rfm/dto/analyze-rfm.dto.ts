import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AnalyzeRfmDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  quartilesCount?: number;
}
