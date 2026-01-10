import { ConversationType } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type!: ConversationType;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  jobId?: string | null;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  participantIds!: string[];
}
