import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  Equals,
} from 'class-validator';
import { BackgroundCheckResult } from '@prisma/client';

export class InitiateBackgroundCheckDto {
  @IsString()
  userId: string;
}

export class ConsentDto {
  @IsBoolean()
  @Equals(true, { message: 'consent.accepted must be true' })
  accepted: boolean;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  textHash?: string;
}

export class UploadDocumentDto {
  @IsString()
  checkId: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  certificateType?: string;
}

export class ReviewBackgroundCheckDto {
  @IsEnum(BackgroundCheckResult, {
    message:
      'result must be one of CLEAN | HAS_RECORDS | DISQUALIFYING | INVALID_DOCUMENT',
  })
  result: BackgroundCheckResult;

  @IsBoolean()
  hasCriminalRecord: boolean;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  @IsBoolean()
  canWorkWithChildren?: boolean;

  @IsOptional()
  @IsBoolean()
  canWorkWithElderly?: boolean;
}
