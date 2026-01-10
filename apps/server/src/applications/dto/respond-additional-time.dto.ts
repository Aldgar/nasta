import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RespondAdditionalTimeDto {
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @IsNumber()
  @Min(1)
  additionalDays!: number; // Number of additional days needed

  @IsString()
  @IsNotEmpty()
  explanation!: string; // Explanation of why these days are needed
}

