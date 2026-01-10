import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMeDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : undefined,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-()\s]*$/u, {
    message: 'Phone can contain digits, spaces, +, -, and parentheses',
  })
  phone?: string;
}
