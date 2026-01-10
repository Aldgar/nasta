import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

interface AdminLite {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  adminCapabilities?: string[];
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const adminId = payload.sub ?? payload.id;
    if (!adminId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Only accept tokens that declare ADMIN role
    if (payload.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }

    // Minimal typed shim to access Admin delegate safely
    const prisma = this.prisma as unknown as {
      admin: { findUnique: (args: unknown) => Promise<AdminLite | null> };
    };

    // Look up admin from the Admin collection
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        adminCapabilities: true,
      },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin not found or inactive');
    }

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: 'ADMIN' as const,
      adminCapabilities: admin.adminCapabilities || [],
      isActive: admin.isActive,
    };
  }
}
