import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CaptureBookingDto {
  // Option A: pass finalAmount explicitly (minor units)
  @IsOptional()
  @IsInt()
  @Min(1)
  finalAmount?: number;

  // Option B: pass approvedUnits and server will compute using agreed rate
  @IsOptional()
  @IsInt()
  @Min(1)
  approvedUnits?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
