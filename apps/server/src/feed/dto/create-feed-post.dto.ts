import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFeedPostDto {
  @ApiProperty({ required: false, maxLength: 140 })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiProperty({ enum: ['ALL', 'JOB_SEEKERS', 'EMPLOYERS'], required: false })
  @IsOptional()
  @IsIn(['ALL', 'JOB_SEEKERS', 'EMPLOYERS'])
  visibility?: 'ALL' | 'JOB_SEEKERS' | 'EMPLOYERS';

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Optional list of attachment URLs',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachments?: string[];

  @ApiProperty({
    required: false,
    description: 'Optional rich content payload (JSON object)',
  })
  @IsOptional()
  rich?: Record<string, unknown>;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'If true, send SYSTEM notifications to the target audience (use sparingly).',
  })
  @IsOptional()
  notify?: boolean;
}
