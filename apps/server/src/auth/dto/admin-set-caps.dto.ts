import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AdminSetCapabilitiesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  adminCapabilities!: string[]; // e.g., ["SUPER_ADMIN", "BACKGROUND_CHECK_REVIEWER"]
}
