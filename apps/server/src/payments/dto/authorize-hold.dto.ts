import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AuthorizeHoldDto {
  // If omitted, server will compute from agreed terms and an estimation; for v1 we require explicit hold amount
  @IsInt()
  @Min(1)
  amount!: number; // minor units

  @IsString()
  @IsNotEmpty()
  currency!: string; // e.g., 'eur'

  // Optional note or context
  @IsOptional()
  @IsString()
  note?: string;
}
