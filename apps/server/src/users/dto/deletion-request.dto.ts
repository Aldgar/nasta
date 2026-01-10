import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeletionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminReviewDeletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
