import { IsOptional, IsString, Length } from 'class-validator';

export class CreateConnectAccountDto {
  // Optional ISO country code for the account; defaults to 'US' or user's country
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
