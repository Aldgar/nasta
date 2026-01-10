import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CAPABILITY_KEY = 'requiredCapability';
export const RequireCapability = (capability: string) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capability);
