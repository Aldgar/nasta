import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendAdminEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  to: string;

  @ApiProperty({ example: 'KYC Verification — Action Required' })
  @IsString()
  subject: string;

  @ApiProperty({ example: 'Dear user, your KYC submission requires ...' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the target user' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'KYC', description: 'Context tag' })
  @IsOptional()
  @IsString()
  context?: string;
}
