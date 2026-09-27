import { IsDateString, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class AnalyzeRfmDto {
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  quartilesCount?: number;
}
