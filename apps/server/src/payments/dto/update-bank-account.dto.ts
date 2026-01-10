import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  // Account number is required only if IBAN is not provided
  @ValidateIf((o) => !o.iban)
  @IsString()
  @IsNotEmpty()
  accountNumber?: string;

  // Routing number is required only if IBAN is not provided
  @ValidateIf((o) => !o.iban)
  @IsString()
  @IsNotEmpty()
  routingNumber?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z]{2}$/, { message: 'Country must be a 2-letter ISO code (e.g., PT, US, LT)' })
  country: string;

  @IsString()
  @IsNotEmpty()
  currency: string; // e.g., 'eur', 'usd'

  @IsString()
  @IsOptional()
  accountHolderType?: 'individual' | 'company';

  // For international accounts (IBAN) - required if accountNumber/routingNumber not provided
  @ValidateIf((o) => !o.accountNumber || !o.routingNumber)
  @IsString()
  @IsNotEmpty()
  iban?: string;

  // For international accounts (SWIFT/BIC)
  @IsString()
  @IsOptional()
  swift?: string;
}

