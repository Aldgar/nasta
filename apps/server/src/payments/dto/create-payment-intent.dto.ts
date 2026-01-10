import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentIntentDto {
  @IsInt()
  @Min(1)
  amount!: number; // smallest currency unit

  @IsString()
  @IsNotEmpty()
  currency!: string; // e.g., 'usd'

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
