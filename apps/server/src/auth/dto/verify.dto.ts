import { IsString, Length } from 'class-validator';

export class VerificationRequestDto {
  @IsString()
  token!: string;
}

export class PhoneVerificationDto {
  @IsString()
  @Length(4, 8)
  code!: string;
}
