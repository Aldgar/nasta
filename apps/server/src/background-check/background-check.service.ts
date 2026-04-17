import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { BackgroundCheckResult, BackgroundCheckStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileUploadService } from './file-upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DocumentAnalysisService } from '../document-analysis/document-analysis.service';

@Injectable()
export class BackgroundCheckService {
  private readonly logger = new Logger(BackgroundCheckService.name);

  constructor(
    private prisma: PrismaService,
    private fileUploadService: FileUploadService,
    private notifications: NotificationsService,
    private documentAnalysis: DocumentAnalysisService,
  ) {}

  async initiate(
    userId: string,
    consent?: { accepted: boolean; version?: string; textHash?: string },
  ) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has a pending/valid check
    const existingCheck = await this.prisma.backgroundCheck.findFirst({
      where: {
        userId,
        status: {
          in: ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'],
        },
      },
    });

    if (existingCheck) {
      if (existingCheck.status === 'APPROVED' && existingCheck.expiryDate) {
        // Check if still valid (not expired)
        if (existingCheck.expiryDate > new Date()) {
          throw new BadRequestException(
            'You already have a valid background check',
          );
        }
      }

      if (
        ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(existingCheck.status)
      ) {
        throw new BadRequestException(
          'You already have a background check in progress',
        );
      }
    }

    if (!consent || consent.accepted !== true) {
      throw new BadRequestException('Consent is required to initiate');
    }

    // Create new background check
    const newCheck = await this.prisma.backgroundCheck.create({
      data: {
        userId,
        status: 'PENDING',
        certificateType: 'INDIVIDUAL',
        consentAcceptedAt: new Date(),
        consentVersion: consent.version || null,
        consentTextHash: consent.textHash || null,
      },
    });

    // Update user's background check status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        backgroundCheckStatus: 'PENDING',
      },
    });

    return {
      id: newCheck.id,
      status: newCheck.status,
      message:
        'Background check initiated. Please upload your Portuguese criminal record certificate.',
    };
  }

  async getCertificatePathByCheckId(checkId: string) {
    const check = await this.prisma.backgroundCheck.findUnique({
      where: { id: checkId },
      select: { uploadedDocument: true },
    });

    if (!check) {
      throw new NotFoundException('Background check not found');
    }

    return check.uploadedDocument ?? null;
  }

  async getCertificatePathForUser(checkId: string, userId: string) {
    const check = await this.prisma.backgroundCheck.findFirst({
      where: { id: checkId, userId },
      select: { uploadedDocument: true },
    });
    if (!check) {
      throw new ForbiddenException(
        'You do not have access to this certificate',
      );
    }
    return check.uploadedDocument ?? null;
  }

  async getDocumentAnalysis(checkId: string) {
    const check = await this.prisma.backgroundCheck.findUnique({
      where: { id: checkId },
      select: {
        id: true,
        status: true,
        documentAnalysisScore: true,
        documentAnalysisFlags: true,
        documentAnalysisRaw: true,
        documentAnalyzedAt: true,
      },
    });
    if (!check) {
      throw new NotFoundException('Background check not found');
    }

    // Parse the raw JSON for the admin to see structured details
    let analysisDetails: unknown = null;
    if (check.documentAnalysisRaw) {
      try {
        analysisDetails = JSON.parse(check.documentAnalysisRaw);
      } catch {
        analysisDetails = check.documentAnalysisRaw;
      }
    }

    return {
      checkId: check.id,
      status: check.status,
      analysis: {
        trustScore: check.documentAnalysisScore,
        flags: check.documentAnalysisFlags,
        analyzedAt: check.documentAnalyzedAt,
        details: analysisDetails,
        riskLevel:
          check.documentAnalysisScore === null
            ? 'NOT_ANALYZED'
            : check.documentAnalysisScore < 0
              ? 'UNAVAILABLE'
              : check.documentAnalysisScore < 30
                ? 'HIGH_RISK'
                : check.documentAnalysisScore < 60
                  ? 'MEDIUM_RISK'
                  : check.documentAnalysisScore < 80
                    ? 'LOW_RISK'
                    : 'CLEAN',
      },
    };
  }

  async uploadDocument(
    checkId: string,
    file: Express.Multer.File,
    certificateNumber?: string,
  ) {
    // Find the background check
    const backgroundCheck = await this.prisma.backgroundCheck.findUnique({
      where: { id: checkId },
      include: { user: true },
    });

    if (!backgroundCheck) {
      throw new NotFoundException('Background check not found');
    }

    if (backgroundCheck.status !== 'PENDING') {
      throw new BadRequestException(
        'Can only upload document for pending background checks',
      );
    }

    try {
      // Save the file using FileUploadService
      const filePath = await this.fileUploadService.saveFile(file);

      // Calculate expiry date (3 months from now for Portuguese certificates)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 3);

      // Update background check with document info
      const updatedCheck = await this.prisma.backgroundCheck.update({
        where: { id: checkId },
        data: {
          uploadedDocument: filePath,
          certificateNumber: certificateNumber || null,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          expiryDate: expiryDate,
          assignedCapability: 'BACKGROUND_CHECK_REVIEWER',
        },
      });

      // Run document analysis in background (don't block the upload response)
      this.runDocumentAnalysis(checkId, filePath).catch((err) => {
        this.logger.error(
          `Background document analysis failed for check ${checkId}:`,
          err,
        );
      });

      // Update user status
      await this.prisma.user.update({
        where: { id: backgroundCheck.userId },
        data: {
          backgroundCheckStatus: 'SUBMITTED',
        },
      });
      // Emit event after successful upload and status update
      this.notifications.emitBackgroundCheckSubmitted({
        userId: backgroundCheck.userId,
        checkId,
      });

      return {
        message:
          'Document uploaded successfully. Your background check will be reviewed within 2-3 business days.',
        checkId: updatedCheck.id,
        status: updatedCheck.status,
        expiryDate: updatedCheck.expiryDate,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to upload document: ${errorMessage}`,
      );
    }
  }

  /**
   * Run GCV document analysis on an uploaded criminal record certificate.
   * Stores results in DB for admin review.
   */
  private async runDocumentAnalysis(
    checkId: string,
    documentPath: string,
  ): Promise<void> {
    if (!this.documentAnalysis.isAvailable()) {
      this.logger.warn('Document analysis skipped — GCV not configured');
      return;
    }

    this.logger.log(
      `Starting document analysis for background check ${checkId}`,
    );
    const result =
      await this.documentAnalysis.analyzeCriminalRecord(documentPath);

    await this.prisma.backgroundCheck.update({
      where: { id: checkId },
      data: {
        documentAnalysisScore: result.trustScore,
        documentAnalysisFlags: result.flags,
        documentAnalysisRaw: result.raw,
        documentAnalyzedAt: new Date(),
      },
    });

    this.logger.log(
      `Document analysis complete for check ${checkId}: score=${result.trustScore}, flags=${result.flags.join(', ') || 'none'}`,
    );

    // If trust score is very low, auto-flag for admin attention
    if (result.trustScore >= 0 && result.trustScore < 30) {
      this.logger.warn(
        `LOW TRUST SCORE (${result.trustScore}) for background check ${checkId} — possible fraud`,
      );
    }
  }

  async getUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
        backgroundCheckResult: true,
        backgroundCheckExpiry: true,
        canWorkWithChildren: true,
        canWorkWithElderly: true,
        canWorkGeneralJobs: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get current background check details
    const currentCheck = await this.prisma.backgroundCheck.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        overallResult: true,
        expiryDate: true,
        rejectionReason: true,
        submittedAt: true,
        verifiedAt: true,
      },
    });

    return {
      userId: user.id,
      isBackgroundVerified: user.isBackgroundVerified,
      backgroundCheckStatus: user.backgroundCheckStatus,
      backgroundCheckResult: user.backgroundCheckResult,
      canWorkWithChildren: user.canWorkWithChildren,
      canWorkWithElderly: user.canWorkWithElderly,
      canWorkGeneralJobs: user.canWorkGeneralJobs,
      currentCheck: currentCheck || undefined,
    };
  }
  async reviewBackgroundCheck(
    checkId: string,
    adminId: string,
    reviewData: {
      result: BackgroundCheckResult;
      hasCriminalRecord: boolean;
      rejectionReason?: string;
      adminNotes?: string;
      canWorkWithChildren?: boolean;
      canWorkWithElderly?: boolean;
    },
  ) {
    // Find the background check
    const backgroundCheck = await this.prisma.backgroundCheck.findUnique({
      where: { id: checkId },
      include: { user: true },
    });

    if (!backgroundCheck) {
      throw new NotFoundException('Background check not found');
    }

    if (
      backgroundCheck.status !== 'SUBMITTED' &&
      backgroundCheck.status !== 'UNDER_REVIEW'
    ) {
      throw new BadRequestException(
        'Can only review submitted or under-review background checks',
      );
    }

    const isApproved =
      reviewData.result === BackgroundCheckResult.CLEAN ||
      reviewData.result === BackgroundCheckResult.HAS_RECORDS;
    const newStatus: BackgroundCheckStatus = isApproved
      ? BackgroundCheckStatus.APPROVED
      : BackgroundCheckStatus.REJECTED;

    // Update background check
    const updatedCheck = await this.prisma.backgroundCheck.update({
      where: { id: checkId },
      data: {
        status: newStatus,
        overallResult: reviewData.result,
        hasCriminalRecord: reviewData.hasCriminalRecord,
        rejectionReason: reviewData.rejectionReason,
        adminNotes: reviewData.adminNotes,
        verifiedBy: adminId,
        verifiedAt: new Date(),
      },
    });

    // Update user permissions
    await this.prisma.user.update({
      where: { id: backgroundCheck.userId },
      data: {
        isBackgroundVerified: isApproved,
        backgroundCheckStatus: newStatus,
        backgroundCheckResult: reviewData.result,
        backgroundCheckExpiry: isApproved ? backgroundCheck.expiryDate : null,
        canWorkWithChildren: reviewData.canWorkWithChildren || false,
        canWorkWithElderly: reviewData.canWorkWithElderly || false,
        canWorkGeneralJobs: true, // Always allow general jobs
      },
    });

    // Notify user of background check decision
    try {
      const user = backgroundCheck.user;
      if (isApproved) {
        await this.notifications.createNotification({
          userId: backgroundCheck.userId,
          type: 'SYSTEM',
          title: 'Background Check Approved',
          body: 'Your criminal record certificate has been reviewed and approved.',
        });
        if (user?.email) {
          await this.notifications.sendEmail(
            user.email,
            'Background Check Approved',
            `Hi ${user.firstName || 'there'}, your criminal record certificate has been reviewed and approved. You're one step closer to applying for jobs on Nasta!`,
          );
        }
      } else {
        await this.notifications.createNotification({
          userId: backgroundCheck.userId,
          type: 'SYSTEM',
          title: 'Background Check Rejected',
          body: reviewData.rejectionReason
            ? `Your criminal record certificate was not approved: ${reviewData.rejectionReason}. Please re-submit.`
            : 'Your criminal record certificate was not approved. Please re-submit a valid certificate.',
        });
        if (user?.email) {
          await this.notifications.sendEmail(
            user.email,
            'Background Check Rejected — Action Required',
            `Hi ${user.firstName || 'there'}, your criminal record certificate was not approved.${reviewData.rejectionReason ? ` Reason: ${reviewData.rejectionReason}.` : ''} Please log in to re-submit.`,
          );
        }
      }
    } catch {
      // Don't fail the review if notification fails
    }

    return {
      id: updatedCheck.id,
      status: updatedCheck.status,
      result: updatedCheck.overallResult,
      message: isApproved
        ? 'Background check approved successfully'
        : 'Background check rejected',
    };
  }

  async getPendingReviews() {
    return await this.prisma.backgroundCheck.findMany({
      where: {
        status: {
          in: ['SUBMITTED', 'UNDER_REVIEW'],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { documentAnalysisScore: 'asc' }, // Show lowest trust scores first
        { submittedAt: 'asc' },
      ],
    });
  }

  // Capability-scoped listings and assignment controls
  async listReviewsScoped(
    adminId: string,
    isSuperAdmin: boolean,
    scope: 'all' | 'mine' | 'unassigned',
    status?: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
  ) {
    const where: Prisma.BackgroundCheckWhereInput = {
      assignedCapability: 'BACKGROUND_CHECK_REVIEWER',
    };
    if (status) where.status = status;
    if (scope === 'mine') where.assignedTo = adminId;
    if (scope === 'unassigned') where.assignedTo = null;

    return this.prisma.backgroundCheck.findMany({
      where,
      orderBy: [
        { documentAnalysisScore: 'asc' }, // Lowest trust scores first
        { submittedAt: 'asc' },
      ],
      select: {
        id: true,
        status: true,
        overallResult: true,
        submittedAt: true,
        verifiedAt: true,
        assignedTo: true,
        assignedCapability: true,
        assignedAt: true,
        documentAnalysisScore: true,
        documentAnalysisFlags: true,
        documentAnalyzedAt: true,
        user: {
          select: {
            id: true,
            publicId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isBackgroundVerified: true,
            backgroundCheckStatus: true,
          },
        },
      },
    });
  }

  async assignBackgroundCheck(adminId: string, checkId: string) {
    const check = await this.prisma.backgroundCheck.findUnique({
      where: { id: checkId },
      select: { id: true, assignedTo: true },
    });
    if (!check) throw new NotFoundException('Background check not found');
    if (check.assignedTo && check.assignedTo !== adminId) {
      throw new BadRequestException('Background check already assigned');
    }
    const updated = await this.prisma.backgroundCheck.update({
      where: { id: checkId },
      data: { assignedTo: adminId, assignedAt: new Date() },
      select: { id: true, assignedTo: true, assignedAt: true },
    });
    return { check: updated, message: 'Assigned to you' };
  }

  async unassignBackgroundCheck(
    adminId: string,
    checkId: string,
    isSuperAdmin: boolean,
  ) {
    const check = await this.prisma.backgroundCheck.findUnique({
      where: { id: checkId },
      select: { id: true, assignedTo: true },
    });
    if (!check) throw new NotFoundException('Background check not found');
    if (check.assignedTo && check.assignedTo !== adminId && !isSuperAdmin) {
      throw new BadRequestException(
        "You cannot unassign another admin's background check",
      );
    }
    const updated = await this.prisma.backgroundCheck.update({
      where: { id: checkId },
      data: { assignedTo: null, assignedAt: null },
      select: { id: true, assignedTo: true, assignedAt: true },
    });
    return { check: updated, message: 'Unassigned' };
  }
}
