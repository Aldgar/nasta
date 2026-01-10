import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApplicationStatusDto {
  @ApiProperty({
    enum: [
      'PENDING',
      'REVIEWING',
      'SHORTLISTED',
      'ACCEPTED',
      'REJECTED',
      'WITHDRAWN',
    ],
  })
  @IsString()
  @IsIn([
    'PENDING',
    'REVIEWING',
    'SHORTLISTED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ])
  status!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
