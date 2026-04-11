import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SelectedRateDto {
  @IsNumber()
  @Min(0)
  rate!: number;

  @IsString()
  @IsNotEmpty()
  paymentType!: string;

  @IsOptional()
  @IsString()
  otherSpecification?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

export class CreateApplicationPaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedRateDto)
  selectedRates!: SelectedRateDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  clientOrigin?: string;
}
