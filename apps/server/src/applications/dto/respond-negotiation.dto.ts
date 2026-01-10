import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RespondNegotiationDto {
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @IsIn(['ACCEPTED', 'REJECTED'])
  status!: 'ACCEPTED' | 'REJECTED';

  @IsOptional()
  @IsString()
  message?: string;
}

