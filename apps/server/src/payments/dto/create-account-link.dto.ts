import { IsUrl, IsOptional, IsString } from 'class-validator';

export class CreateAccountLinkDto {
  @IsUrl()
  returnUrl!: string;

  @IsUrl()
  refreshUrl!: string;

  @IsOptional()
  @IsString()
  state?: string;
}
