import { IsNotEmpty, IsString, IsArray, IsNumber, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class CounterOfferRateDto {
  @ApiProperty({ description: 'Rate amount' })
  @IsNotEmpty()
  @IsNumber()
  rate: number;

  @ApiProperty({ description: 'Payment type (HOUR, DAY, WEEK, MONTH, PROJECT, OTHER)' })
  @IsNotEmpty()
  @IsString()
  paymentType: string;

  @ApiProperty({ description: 'Other payment type specification (if paymentType is OTHER)', required: false })
  @IsOptional()
  @IsString()
  otherSpecification?: string;
}

export class CounterOfferNegotiationDto {
  @ApiProperty({ description: 'Negotiation request ID' })
  @IsNotEmpty()
  @IsString()
  requestId: string;

  @ApiProperty({ description: 'Counter offer rates', type: [CounterOfferRateDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CounterOfferRateDto)
  rates: CounterOfferRateDto[];

  @ApiProperty({ description: 'Total amount of counter offer' })
  @IsNotEmpty()
  @IsNumber()
  totalAmount: number;

  @ApiProperty({ description: 'Optional message explaining the counter offer', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

