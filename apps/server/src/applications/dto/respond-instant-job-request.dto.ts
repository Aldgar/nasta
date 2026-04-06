import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RespondInstantJobRequestDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
