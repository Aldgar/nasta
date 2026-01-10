import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AdditionalRateDto {
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

export class RequestAdditionalRatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalRateDto)
  rates!: AdditionalRateDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  message?: string;
}

