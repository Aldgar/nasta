import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_CAPABILITY_KEY } from '../decorators/require-capability.decorator';
import type { Request } from 'express';

@Injectable()
export class AdminCapabilityGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(
      REQUIRE_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true; // no capability required

    const req = context.switchToHttp().getRequest<Request>();
    const rawUser = req.user;
    const safeUser = (() => {
      if (rawUser && typeof rawUser === 'object') {
        const u = rawUser as Record<string, unknown>;
        const role = typeof u.role === 'string' ? u.role : undefined;
        const caps = Array.isArray(u.adminCapabilities)
          ? (u.adminCapabilities as string[])
          : undefined;
        return { role, adminCapabilities: caps };
      }
      return {} as { role?: string; adminCapabilities?: string[] };
    })();
    if (!safeUser || safeUser.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }

    const caps = Array.isArray(safeUser.adminCapabilities)
      ? safeUser.adminCapabilities
      : [];
    if (caps.includes('SUPER_ADMIN') || caps.includes(required)) {
      return true;
    }
    throw new UnauthorizedException('Missing required admin capability');
  }
}
