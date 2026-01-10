import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  })
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  })
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  })
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  })
  @IsString()
  state?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  })
  @IsString()
  postalCode?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  })
  @IsString()
  country?: string;

  // Legacy fields for backwards compatibility
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return value;
  })
  @IsString()
  location?: string;

  @IsOptional()
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
  lat?: number;

  @IsOptional()
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
  lng?: number;
}
