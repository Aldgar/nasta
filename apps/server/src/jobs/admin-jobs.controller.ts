import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('admin-jobs')
@Controller('admin/jobs')
@Public()
@UseGuards(AdminJwtGuard)
export class AdminJobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list all jobs with optional status filter' })
  async list(
    @Query('status')
    status?:
      | 'DRAFT'
      | 'ACTIVE'
      | 'ASSIGNED'
      | 'COMPLETED'
      | 'PAUSED'
      | 'CLOSED'
      | 'EXPIRED'
      | 'CANCELLED_NO_SHOW',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { employer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        select: {
          id: true,
          title: true,
          status: true,
          city: true,
          country: true,
          createdAt: true,
          isInstantBook: true,
          paymentType: true,
          salaryMin: true,
          salaryMax: true,
          currency: true,
          employer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          category: { select: { id: true, name: true } },
          _count: { select: { applications: true, bookings: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);
    return { items, total, page: p, limit: l };
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: get full job details with movements' })
  async get(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        employer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            phone: true,
            avatar: true,
            location: true,
            city: true,
            country: true,
            createdAt: true,
          },
        },
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        skills: {
          select: { id: true, skill: { select: { id: true, name: true } } },
        },
        applications: {
          orderBy: { appliedAt: 'desc' },
          select: {
            id: true,
            status: true,
            coverLetter: true,
            proposedRate: true,
            currency: true,
            verificationCode: true,
            verificationCodeVerifiedAt: true,
            serviceProviderMarkedDoneAt: true,
            rejectionReason: true,
            withdrawalReason: true,
            appliedAt: true,
            updatedAt: true,
            completedAt: true,
            payment: {
              select: {
                id: true,
                type: true,
                status: true,
                amount: true,
                currency: true,
                stripePaymentIntentId: true,
                createdAt: true,
              },
            },
            applicant: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
                isIdVerified: true,
                isBackgroundVerified: true,
                noShowCount: true,
                city: true,
                country: true,
              },
            },
            completionRatings: {
              select: {
                id: true,
                platformRating: true,
                easeOfServiceRating: true,
                otherPartyRating: true,
                platformComment: true,
                otherPartyComment: true,
                raterId: true,
                createdAt: true,
              },
            },
          },
        },
        bookings: {
          orderBy: { bookedAt: 'desc' },
          select: {
            id: true,
            status: true,
            title: true,
            bookedAt: true,
            updatedAt: true,
            completedAt: true,
            startTime: true,
            endTime: true,
            actualRate: true,
            currency: true,
            agreedPayUnit: true,
            agreedRateAmount: true,
            agreedCurrency: true,
            holdAmount: true,
            holdIntentId: true,
            capturedAmount: true,
            capturedAt: true,
            approvedUnits: true,
            finalAmount: true,
            stripeTransferId: true,
            payoutStatus: true,
            payoutDate: true,
            notes: true,
            jobSeeker: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
                isIdVerified: true,
                isBackgroundVerified: true,
                noShowCount: true,
                city: true,
                country: true,
              },
            },
            employer: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            timesheetEntries: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                clockIn: true,
                clockOut: true,
                approvedByEmployer: true,
                createdAt: true,
              },
            },
          },
        },
        referrals: {
          select: {
            id: true,
            createdAt: true,
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    return job;
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: update job status' })
  async setStatus(
    @Param('id') id: string,
    @Body('status')
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED',
  ) {
    const allowed = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'];
    if (!allowed.includes(String(status))) {
      throw new BadRequestException('Invalid status');
    }
    const updated = await this.prisma.job.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
    return { job: updated, message: 'Status updated' };
  }
}
