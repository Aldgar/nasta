import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  IsNumber,
  Matches,
  ValidateIf,
  IsDateString,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @IsOptional()
  @ArrayNotEmpty()
  @IsString({ each: true })
  requirements?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  responsibilities?: string[];

  // Category can be provided either by ID or by name.
  // If categoryName is missing, require a valid Mongo ObjectId for categoryId.
  @ValidateIf((o: unknown) => !(o as { categoryName?: string }).categoryName)
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/u, {
    message: 'categoryId must be a valid Mongo ObjectId',
  })
  categoryId?: string; // Mongo ObjectId string

  // If categoryId is missing, require a non-empty categoryName
  @ValidateIf((o: unknown) => !(o as { categoryId?: string }).categoryId)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryName?: string;

  @IsOptional()
  @IsIn([
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'TEMPORARY',
    'INTERNSHIP',
    'FREELANCE',
    'GIG',
  ])
  type?:
    | 'FULL_TIME'
    | 'PART_TIME'
    | 'CONTRACT'
    | 'TEMPORARY'
    | 'INTERNSHIP'
    | 'FREELANCE'
    | 'GIG';

  @IsNotEmpty()
  @IsIn(['ON_SITE', 'REMOTE', 'HYBRID'])
  workMode!: 'ON_SITE' | 'REMOTE' | 'HYBRID';

  @IsOptional()
  @IsBoolean()
  isInstantBook?: boolean;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsString()
  duration?: string; // e.g., "2 hours", "1 week", "1 month"

  @IsOptional()
  @IsBoolean()
  showContactInfo?: boolean; // Whether to show employer contact details

  // Location fields
  @IsString()
  @IsNotEmpty()
  location!: string; // address line text

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @Transform(({ value }): number | undefined =>
    typeof value === 'string'
      ? Number(value)
      : typeof value === 'number'
        ? value
        : undefined,
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Transform(({ value }): number | undefined =>
    typeof value === 'string'
      ? Number(value)
      : typeof value === 'number'
        ? value
        : undefined,
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // Payment fields
  @IsOptional()
  @IsNumber()
  @Min(0)
  rateAmount?: number; // Amount in cents (smallest currency unit)

  @IsOptional()
  @IsString()
  @IsIn([
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CAD',
    'AUD',
    'CHF',
    'CNY',
    'INR',
    'BRL',
    'MXN',
    'ZAR',
    'KRW',
    'SGD',
    'HKD',
    'NZD',
    'NOK',
    'SEK',
    'DKK',
    'PLN',
    'RUB',
    'TRY',
    'THB',
    'MYR',
    'PHP',
    'IDR',
    'VND',
  ])
  currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'FIXED'])
  paymentType?: string;

  @IsOptional()
  @IsBoolean()
  requiresVehicle?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDriverLicense?: boolean;
}
