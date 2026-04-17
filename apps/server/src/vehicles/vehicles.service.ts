import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';
import { DocumentAnalysisService } from '../document-analysis/document-analysis.service';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailTranslations: EmailTranslationsService,
    private readonly documentAnalysis: DocumentAnalysisService,
  ) {}

  async createVehicle(
    userId: string,
    data: {
      vehicleType: 'TRUCK' | 'VAN' | 'CAR' | 'MOTORCYCLE' | 'OTHER';
      otherTypeSpecification?: string;
      make: string;
      model: string;
      year: number;
      color?: string;
      licensePlate: string;
      capacity?: string;
    },
  ) {
    if (data.vehicleType === 'OTHER' && !data.otherTypeSpecification) {
      throw new BadRequestException(
        'Please specify the vehicle type when selecting OTHER',
      );
    }
    return this.prisma.vehicle.create({
      data: {
        userId,
        vehicleType: data.vehicleType,
        otherTypeSpecification: data.otherTypeSpecification,
        make: data.make,
        model: data.model,
        year: data.year,
        color: data.color,
        licensePlate: data.licensePlate,
        capacity: data.capacity,
      },
    });
  }

  async updateVehicleDetails(
    userId: string,
    vehicleId: string,
    data: {
      vehicleType?: 'TRUCK' | 'VAN' | 'CAR' | 'MOTORCYCLE' | 'OTHER';
      otherTypeSpecification?: string;
      make?: string;
      model?: string;
      year?: number;
      color?: string;
      licensePlate?: string;
      capacity?: string;
    },
  ) {
    const vehicle = await this.getOwnedVehicle(userId, vehicleId);
    if (vehicle.status === 'VERIFIED') {
      throw new ForbiddenException(
        'Cannot modify a verified vehicle. Please contact support.',
      );
    }
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...data,
        status: 'PENDING',
        adminNotes: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });
  }

  async updateVehiclePhoto(
    vehicleId: string,
    field:
      | 'photoFrontUrl'
      | 'photoBackUrl'
      | 'photoLeftUrl'
      | 'photoRightUrl'
      | 'vehicleLicenseUrl',
    url: string,
  ) {
    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { [field]: url },
    });

    // Trigger document analysis for vehicle license uploads
    if (field === 'vehicleLicenseUrl') {
      this.runVehicleLicenseAnalysis(
        vehicleId,
        url,
        updated.licensePlate,
      ).catch((err) => {
        this.logger.error(
          `Vehicle license analysis failed for vehicle ${vehicleId}:`,
          err,
        );
      });
    }

    return updated;
  }

  /**
   * Run GCV document analysis on an uploaded vehicle license/registration.
   * Cross-checks extracted plate against the user-provided plate.
   */
  private async runVehicleLicenseAnalysis(
    vehicleId: string,
    documentPath: string,
    expectedPlate: string,
  ): Promise<void> {
    if (!this.documentAnalysis.isAvailable()) {
      this.logger.warn(
        'Vehicle document analysis skipped — GCV not configured',
      );
      return;
    }

    this.logger.log(`Starting document analysis for vehicle ${vehicleId}`);
    const result = await this.documentAnalysis.analyzeVehicleLicense(
      documentPath,
      expectedPlate,
    );

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        documentAnalysisScore: result.trustScore,
        documentAnalysisFlags: result.flags,
        documentAnalysisRaw: result.raw,
        documentAnalyzedAt: new Date(),
      },
    });

    this.logger.log(
      `Vehicle license analysis complete for ${vehicleId}: score=${result.trustScore}, flags=${result.flags.join(', ') || 'none'}`,
    );

    if (result.trustScore >= 0 && result.trustScore < 30) {
      this.logger.warn(
        `LOW TRUST SCORE (${result.trustScore}) for vehicle ${vehicleId} — possible fraud`,
      );
    }
  }

  async getMyVehicles(userId: string) {
    return this.prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteVehicle(userId: string, vehicleId: string) {
    const vehicle = await this.getOwnedVehicle(userId, vehicleId);
    if (vehicle.status === 'VERIFIED') {
      throw new ForbiddenException(
        'Cannot delete a verified vehicle. Please contact support.',
      );
    }
    return this.prisma.vehicle.delete({ where: { id: vehicleId } });
  }

  async getOwnedVehicle(userId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (vehicle.userId !== userId) {
      throw new ForbiddenException('You do not own this vehicle');
    }
    return vehicle;
  }

  // --- Admin methods ---

  async getPendingVehicles(skip = 0, take = 20) {
    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { status: 'PENDING' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.vehicle.count({ where: { status: 'PENDING' } }),
    ]);
    return { vehicles, total };
  }

  async getPendingCount() {
    return this.prisma.vehicle.count({ where: { status: 'PENDING' } });
  }

  async getVehicleForAdmin(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            phone: true,
          },
        },
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    return vehicle;
  }

  async getVehicleAnalysis(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        licensePlate: true,
        status: true,
        documentAnalysisScore: true,
        documentAnalysisFlags: true,
        documentAnalysisRaw: true,
        documentAnalyzedAt: true,
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    let analysisDetails: unknown = null;
    if (vehicle.documentAnalysisRaw) {
      try {
        analysisDetails = JSON.parse(vehicle.documentAnalysisRaw);
      } catch {
        analysisDetails = vehicle.documentAnalysisRaw;
      }
    }

    return {
      vehicleId: vehicle.id,
      licensePlate: vehicle.licensePlate,
      status: vehicle.status,
      analysis: {
        trustScore: vehicle.documentAnalysisScore,
        flags: vehicle.documentAnalysisFlags,
        analyzedAt: vehicle.documentAnalyzedAt,
        details: analysisDetails,
        riskLevel:
          vehicle.documentAnalysisScore === null
            ? 'NOT_ANALYZED'
            : vehicle.documentAnalysisScore < 0
              ? 'UNAVAILABLE'
              : vehicle.documentAnalysisScore < 30
                ? 'HIGH_RISK'
                : vehicle.documentAnalysisScore < 60
                  ? 'MEDIUM_RISK'
                  : vehicle.documentAnalysisScore < 80
                    ? 'LOW_RISK'
                    : 'CLEAN',
      },
    };
  }

  async reviewVehicle(
    vehicleId: string,
    adminId: string,
    status: 'VERIFIED' | 'REJECTED',
    adminNotes?: string,
  ) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status,
        adminNotes: adminNotes || null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    // Send notifications to the vehicle owner
    await this.sendVehicleReviewNotification(vehicle.userId, updated);

    return updated;
  }

  private async sendVehicleReviewNotification(
    userId: string,
    vehicle: { make: string; model: string; year: number; status: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (!user) return;

    const t = await this.emailTranslations.getTranslatorForUser(userId);
    const vehicleName = `${vehicle.make} ${vehicle.model} (${vehicle.year})`;
    const isApproved = vehicle.status === 'VERIFIED';

    const title = isApproved
      ? 'Vehicle Verified'
      : 'Vehicle Verification Rejected';
    const body = isApproved
      ? `Your vehicle ${vehicleName} has been verified. You can now accept vehicle-related jobs.`
      : `Your vehicle ${vehicleName} verification was rejected. Please check the details and resubmit.`;

    // Email
    const greeting = `Hi ${user.firstName || 'there'},`;
    const emailHtml = this.notifications.getBrandedEmailTemplate(
      title,
      greeting,
      `<p>${body}</p>`,
      isApproved
        ? 'You can now browse and accept vehicle-related jobs on Nasta.'
        : 'If you believe this was a mistake, please contact our support team.',
    );
    await this.notifications.sendEmail(user.email, title, body, emailHtml);

    // Push notification
    await this.notifications.sendPushNotification(userId, title, body, {
      type: 'VEHICLE_REVIEW',
      vehicleStatus: vehicle.status,
    });

    // In-app notification
    await this.notifications.createNotification({
      userId,
      type: 'SYSTEM',
      title,
      body,
      payload: { type: 'VEHICLE_REVIEW', vehicleStatus: vehicle.status },
    });
  }

  async getUserVerifiedVehicles(userId: string) {
    return this.prisma.vehicle.findMany({
      where: { userId, status: 'VERIFIED' },
      select: {
        id: true,
        vehicleType: true,
        otherTypeSpecification: true,
        make: true,
        model: true,
        year: true,
        color: true,
        capacity: true,
        photoFrontUrl: true,
      },
    });
  }

  async hasVerifiedVehicle(userId: string): Promise<boolean> {
    const count = await this.prisma.vehicle.count({
      where: { userId, status: 'VERIFIED' },
    });
    return count > 0;
  }
}
