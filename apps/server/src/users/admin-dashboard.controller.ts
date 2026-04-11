import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';
import { VehiclesService } from '../vehicles/vehicles.service';

@Controller('admin')
@Public()
@UseGuards(AdminJwtGuard)
export class AdminDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  @Get('dashboard-stats')
  async getDashboardStats() {
    const [
      totalUsers,
      kycPending,
      kycInReview,
      openTickets,
      unassignedTickets,
      abuseReports,
      securityReports,
      pendingDeletions,
      vehiclesPending,
      totalJobs,
      activeJobs,
      totalBookings,
      activeBookings,
    ] = await Promise.all([
      // Total users
      this.prisma.user.count(),

      // KYC: pending verifications
      this.prisma.idVerification.count({
        where: { status: 'PENDING' },
      }),

      // KYC: in-review verifications (IN_PROGRESS + MANUAL_REVIEW)
      this.prisma.idVerification.count({
        where: { status: { in: ['IN_PROGRESS', 'MANUAL_REVIEW'] } },
      }),

      // Support tickets: open (OPEN + IN_PROGRESS), excluding surveys/abuse/security
      this.prisma.supportTicket.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          category: {
            notIn: ['EMPLOYER_SURVEY', 'PROVIDER_SURVEY', 'ABUSE', 'SECURITY'],
          },
        },
      }),

      // Support tickets: unassigned
      this.prisma.supportTicket.count({
        where: {
          assignedTo: null,
          status: 'OPEN',
          category: {
            notIn: ['EMPLOYER_SURVEY', 'PROVIDER_SURVEY', 'ABUSE', 'SECURITY'],
          },
        },
      }),

      // Abuse reports (open)
      this.prisma.supportTicket.count({
        where: {
          category: 'ABUSE',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),

      // Security reports (open)
      this.prisma.supportTicket.count({
        where: {
          category: 'SECURITY',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),

      // Pending deletion requests
      this.prisma.deletionRequest.count({
        where: { status: 'PENDING' },
      }),

      // Pending vehicle verifications
      this.vehiclesService.getPendingCount(),

      // Total jobs
      this.prisma.job.count(),

      // Active jobs
      this.prisma.job.count({
        where: { status: { in: ['ACTIVE', 'ASSIGNED'] } },
      }),

      // Total bookings
      this.prisma.booking.count(),

      // Active bookings (PENDING + CONFIRMED + IN_PROGRESS)
      this.prisma.booking.count({
        where: { status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } },
      }),
    ]);

    return {
      totalUsers,
      kycPending,
      kycInReview,
      openTickets,
      unassignedTickets,
      abuseReports,
      securityReports,
      pendingDeletions,
      vehiclesPending,
      totalJobs,
      activeJobs,
      totalBookings,
      activeBookings,
    };
  }

  @Get('dashboard/vehicles/pending')
  async getVehiclesPending(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.vehiclesService.getPendingVehicles(
      Number(skip) || 0,
      Number(take) || 20,
    );
  }

  @Get('dashboard/vehicles/pending/count')
  async getVehiclesPendingCount() {
    const count = await this.vehiclesService.getPendingCount();
    return { count };
  }

  @Get('dashboard/vehicles/:id')
  async getVehicleDetail(@Param('id') id: string) {
    return this.vehiclesService.getVehicleForAdmin(id);
  }

  @Patch('dashboard/vehicles/:id/review')
  async reviewVehicle(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'VERIFIED' | 'REJECTED'; adminNotes?: string },
  ) {
    const adminId = req.user?.id || req.user?.sub;
    return this.vehiclesService.reviewVehicle(
      id,
      adminId,
      body.status,
      body.adminNotes,
    );
  }
}
