import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_POLICY } from '../decorators/rate-limit.decorator';

interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RequestThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.get<RateLimitPolicy>(RATE_LIMIT_POLICY, context.getHandler());
    if (!policy) return true;

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const address = request.ip || request.socket?.remoteAddress || 'unknown';
    const key = `${address}:${context.getHandler().name}`;
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + policy.windowMs };
      this.buckets.set(key, bucket);
    }

    if (bucket.count >= policy.limit) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      throw new HttpException('Слишком много запросов. Попробуйте позже.', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.count += 1;
    if (this.buckets.size > 10000) {
      for (const [bucketKey, entry] of this.buckets) {
        if (entry.resetAt <= now) this.buckets.delete(bucketKey);
      }
      while (this.buckets.size > 10000) {
        const oldestKey = this.buckets.keys().next().value;
        if (!oldestKey) break;
        this.buckets.delete(oldestKey);
      }
    }
    return true;
  }
}
