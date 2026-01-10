import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RespondAdditionalTimeResponseDto {
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @IsEnum(['ACCEPTED', 'REJECTED'])
  status!: 'ACCEPTED' | 'REJECTED';

  @IsOptional()
  @IsString()
  message?: string; // Optional message from employer
}

