import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AdminCreateDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsArray()
  @IsOptional()
  adminCapabilities?: string[]; // e.g., ["SUPER_ADMIN", "BACKGROUND_CHECK_REVIEWER"]
}
