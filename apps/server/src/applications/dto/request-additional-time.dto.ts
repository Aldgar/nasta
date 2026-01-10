import { IsNotEmpty, IsString } from 'class-validator';

export class RequestAdditionalTimeDto {
  @IsString()
  @IsNotEmpty()
  message!: string; // Explanation of why additional time is needed
}

