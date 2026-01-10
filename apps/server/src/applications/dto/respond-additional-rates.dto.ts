import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RespondAdditionalRatesDto {
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  message?: string;
}

