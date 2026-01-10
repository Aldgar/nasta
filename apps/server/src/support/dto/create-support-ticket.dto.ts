import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum SupportCategory {
  GENERAL = 'GENERAL',
  TECHNICAL = 'TECHNICAL',
  BILLING = 'BILLING',
  VERIFICATION = 'VERIFICATION',
  ACCOUNT = 'ACCOUNT',
  REPORT = 'REPORT',
  ABUSE = 'ABUSE',
  SECURITY = 'SECURITY',
  EMPLOYER_SURVEY = 'EMPLOYER_SURVEY',
  PROVIDER_SURVEY = 'PROVIDER_SURVEY',
}

export enum SupportPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsEnum(SupportCategory)
  category?: SupportCategory;

  @IsOptional()
  @IsEnum(SupportPriority)
  priority?: SupportPriority;

  // For anonymous submissions
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

