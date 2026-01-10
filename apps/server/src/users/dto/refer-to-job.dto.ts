import { IsNotEmpty, IsString } from 'class-validator';

export class ReferToJobDto {
  @IsString()
  @IsNotEmpty()
  jobId!: string;
}

