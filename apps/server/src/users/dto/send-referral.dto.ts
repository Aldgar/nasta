import { IsString, IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendReferralDto {
  @ApiProperty({
    description: "Friend's name",
    example: 'John Doe',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  friendName: string;

  @ApiProperty({
    description: "Friend's email address",
    example: 'john@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  friendEmail: string;
}

