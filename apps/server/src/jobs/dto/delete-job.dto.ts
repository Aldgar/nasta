import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteJobDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

