import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VerifiedForJobsGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as {
      id: string;
      role?: 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
      isBackgroundVerified?: boolean;
    };
    if (user?.role === 'ADMIN') {
      const allow = this.config.get<string>('DEV_ALLOW_ADMIN_APPLY');
      if (String(allow).toLowerCase() === 'true') {
        return true;
      }
      throw new ForbiddenException('Admins are not allowed to apply to jobs');
    }
    const bgOk = !!user?.isBackgroundVerified;
    if (!user?.id || !bgOk)
      throw new ForbiddenException(
        'You must verify email, phone, and pass background check to apply for jobs',
      );

    const vt = (
      this.prisma as unknown as {
        verificationToken: {
          findFirst: (args: {
            where: {
              userId: string;
              type: 'EMAIL' | 'PHONE';
              consumed: boolean;
            };
          }) => Promise<{ id: string } | null>;
        };
      }
    ).verificationToken;

    const [emailToken, phoneToken] = await Promise.all([
      vt.findFirst({
        where: { userId: user.id, type: 'EMAIL', consumed: true },
      }),
      vt.findFirst({
        where: { userId: user.id, type: 'PHONE', consumed: true },
      }),
    ]);

    if (!(emailToken && phoneToken)) {
      throw new ForbiddenException(
        'You must verify email, phone, and pass background check to apply for jobs',
      );
    }

    // Additional guard: if this job requires a driver license, ensure the user has a verified DRIVERS_LICENSE
    const jobId = (req.params as Record<string, string | undefined>)?.id;
    if (jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          status: true,
          category: {
            select: { id: true, requiresDriverLicense: true, name: true },
          },
        },
      });
      if (
        job &&
        job.status === 'ACTIVE' &&
        job.category?.requiresDriverLicense
      ) {
        const dl = await this.prisma.idVerification.findFirst({
          where: {
            userId: user.id,
            verificationType: 'DRIVERS_LICENSE',
            status: 'VERIFIED',
          },
          select: {
            id: true,
            documentFrontUrl: true,
            documentBackUrl: true,
            documentExpiry: true,
          },
        });
        const hasFrontBack = !!dl?.documentFrontUrl && !!dl?.documentBackUrl;
        // If expiry is set and in the past, treat as invalid
        const notExpired =
          !dl?.documentExpiry || dl.documentExpiry > new Date();
        if (!(dl && hasFrontBack && notExpired)) {
          throw new ForbiddenException(
            'A valid driver license (front and back, verified) is required to apply for this job',
          );
        }
      }
    }

    return true;
  }
}
