import { IsString, IsNotEmpty } from 'class-validator';

export class WithdrawApplicationDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

