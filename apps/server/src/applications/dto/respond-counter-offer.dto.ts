import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RespondCounterOfferDto {
  @ApiProperty({ description: 'Negotiation request ID' })
  @IsNotEmpty()
  @IsString()
  requestId: string;

  @ApiProperty({ description: 'Counter offer ID' })
  @IsNotEmpty()
  @IsString()
  counterOfferId: string;

  @ApiProperty({ description: 'Response status (ACCEPTED or REJECTED)' })
  @IsNotEmpty()
  @IsString()
  status: 'ACCEPTED' | 'REJECTED';

  @ApiProperty({ description: 'Optional message explaining the response', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

