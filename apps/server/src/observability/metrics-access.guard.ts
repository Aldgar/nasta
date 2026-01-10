import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';

@Injectable()
export class MetricsAccessGuard implements CanActivate {
  constructor(private readonly adminGuard: AdminJwtGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    // 1) IP allowlist: METRICS_IP_ALLOWLIST=ip1,ip2
    const allow = (process.env.METRICS_IP_ALLOWLIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allow.length > 0) {
      const xfwd =
        (req.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')
          .map((s) => s.trim()) ?? [];
      const candidates = new Set<string>([req.ip, ...xfwd]);
      for (const ip of candidates) {
        if (allow.includes(ip)) {
          return true;
        }
      }
    }

    // 2) Fallback to Admin JWT auth
    return await this.adminGuard.canActivate(context);
  }
}
