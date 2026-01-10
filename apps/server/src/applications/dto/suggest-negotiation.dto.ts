import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NegotiationRateDto {
  @IsNumber()
  @Min(0)
  rate!: number;

  @IsString()
  @IsNotEmpty()
  paymentType!: string;

  @IsOptional()
  @IsString()
  otherSpecification?: string;
}

export class SuggestNegotiationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NegotiationRateDto)
  rates!: NegotiationRateDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsString()
  @IsNotEmpty()
  message!: string; // Mandatory message explaining why the amount is high
}

