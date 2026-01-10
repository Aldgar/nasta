import { IsArray, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
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
}

export class CreateApplicationPaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedRateDto)
  selectedRates!: SelectedRateDto[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;
}

