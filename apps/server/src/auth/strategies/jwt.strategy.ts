import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
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
    const userId = payload.sub ?? payload.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // If role is ADMIN, check Admin collection instead of User collection
    if (payload.role === 'ADMIN') {
      const prisma = this.prisma as unknown as {
        admin: {
          findUnique: (args: {
            where: { id: string };
            select: {
              id: true;
              email: true;
              firstName: true;
              lastName: true;
              isActive: true;
              adminCapabilities: true;
            };
          }) => Promise<{
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            isActive: boolean;
            adminCapabilities: string[];
          } | null>;
        };
      };

      const admin = await prisma.admin.findUnique({
        where: { id: userId },
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
        adminCapabilities: Array.isArray(admin.adminCapabilities)
          ? admin.adminCapabilities
          : [],
        isActive: admin.isActive,
        isBackgroundVerified: false,
        backgroundCheckStatus: null,
      };
    }

    // For non-admin users, use the regular User collection
    const user = await this.authService.validateUserById(userId);
    const caps = (user as Record<string, unknown>)?.adminCapabilities;
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      adminCapabilities: Array.isArray(caps) ? (caps as string[]) : [],
      isActive: user.isActive,
      isBackgroundVerified: user.isBackgroundVerified,
      backgroundCheckStatus: user.backgroundCheckStatus,
    };
  }
}
