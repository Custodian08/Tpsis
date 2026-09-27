import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_POLICY = 'rateLimitPolicy';

export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_POLICY, { limit, windowMs });
