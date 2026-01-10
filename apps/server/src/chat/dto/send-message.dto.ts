import { Prisma } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  // Can't deeply validate arbitrary JSON; rely on runtime handling
  payload?: Prisma.InputJsonValue;
}
