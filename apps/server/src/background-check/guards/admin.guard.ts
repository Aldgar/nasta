import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { admin?: User }>();

    // Get admin ID from request headers
    const adminIdHeader = request.headers['x-admin-id'];
    const adminId = Array.isArray(adminIdHeader)
      ? adminIdHeader[0]
      : adminIdHeader;

    if (!adminId || typeof adminId !== 'string') {
      throw new UnauthorizedException('Admin ID is required in headers');
    }

    // Verify admin exists and has ADMIN role
    const admin = await this.prisma.user.findFirst({
      where: {
        id: adminId,
        role: UserRole.ADMIN,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Add admin to request object for use in controllers
    request.admin = admin;
    return true;
  }
}
