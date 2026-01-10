import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  BookingStatus,
  PaymentType,
  PaymentStatusDb,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';
import { PaymentsService } from '../payments/payments.service';

type ApplicationStatus =
  | 'PENDING'
  | 'REVIEWING'
  | 'SHORTLISTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

@Injectable()
export class ApplicationsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private emailTranslations: EmailTranslationsService,
    private payments: PaymentsService,
  ) {}

  private generate4DigitVerificationCode(exclude?: string | null): string {
    // Try a few times to avoid returning the same code.
    for (let i = 0; i < 5; i++) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      if (!exclude || code !== exclude) return code;
    }
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private normalizeRateKey(rate: {
    rate: number;
    paymentType: string;
    otherSpecification?: string;
  }): string {
    return `${rate.rate}|${rate.paymentType}|${rate.otherSpecification || ''}`;
  }

  private async ensurePendingVerificationCode(
    applicationId: string,
    mode: 'SOFT' | 'HARD',
  ) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        status: true,
        verificationCodeVersion: true,
        pendingVerificationCodeVersion: true,
        pendingVerificationCodeLockMode: true,
      },
    });

    if (!app || app.status !== 'ACCEPTED') return;

    const currentVersion = app.verificationCodeVersion || 1;
    const pendingVersion =
      app.pendingVerificationCodeVersion ?? currentVersion + 1;
    const existingMode = app.pendingVerificationCodeLockMode as
      | 'SOFT'
      | 'HARD'
      | null
      | undefined;
    const nextMode: 'SOFT' | 'HARD' =
      existingMode === 'HARD' || mode === 'HARD' ? 'HARD' : 'SOFT';

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        pendingVerificationCodeVersion: pendingVersion,
        pendingVerificationCodeLockMode: nextMode,
      },
    });
  }

  private async clearSoftPendingVerificationCodeIfAny(applicationId: string) {
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        pendingVerificationCodeVersion: null,
        pendingVerificationCodeLockMode: null,
      },
    });
  }

  private async maybeRotateVerificationCodeAfterPayment(
    applicationId: string,
    paymentCheck: {
      unpaidAmount: number;
      unpaidServices?: any[];
      unpaidNegotiations?: any[];
    },
  ) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        status: true,
        verificationCode: true,
        verificationCodeVersion: true,
        pendingVerificationCodeVersion: true,
        pendingVerificationCodeLockMode: true,
        verificationCodeVerifiedVersion: true,
      },
    });
    if (!app || app.status !== 'ACCEPTED') return;

    if (!app.pendingVerificationCodeVersion) return;

    const hasUnpaidItems =
      (paymentCheck.unpaidAmount ?? 0) > 0.01 ||
      (paymentCheck.unpaidServices?.length ?? 0) > 0 ||
      (paymentCheck.unpaidNegotiations?.length ?? 0) > 0;
    if (hasUnpaidItems) return;

    const newVersion = app.pendingVerificationCodeVersion;
    const newCode = this.generate4DigitVerificationCode(app.verificationCode);

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        verificationCode: newCode,
        verificationCodeVersion: newVersion,
        pendingVerificationCodeVersion: null,
        pendingVerificationCodeLockMode: null,
        // Keep verificationCodeVerifiedAt as history of the last verification event,
        // but require re-verification by version comparison.
        verificationCodeVerifiedVersion:
          app.verificationCodeVerifiedVersion ?? 0,
      },
    });
  }

  private isValidObjectId(id: string | undefined | null): id is string {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  }

  async getApplicationForUser(
    userId: string,
    role: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN' | undefined,
    applicationId: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        completedAt: true,
        coverLetter: true,
        proposedRate: true,
        currency: true,
        applicantId: true,
        additionalRateRequests: true,
        negotiationRequests: true,
        additionalTimeRequests: true,
        selectedRates: true,
        verificationCode: true, // Include verification code
        verificationCodeVerifiedAt: true, // Include verification timestamp
        verificationCodeLastVerifiedAt: true,
        verificationCodeVersion: true,
        verificationCodeVerifiedVersion: true,
        pendingVerificationCodeVersion: true,
        pendingVerificationCodeLockMode: true,
        serviceProviderMarkedDoneAt: true,
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            bio: true,
            location: true,
            city: true,
            country: true,
            isIdVerified: true,
            isBackgroundVerified: true,
            idVerificationStatus: true,
            backgroundCheckStatus: true,
            userProfile: {
              select: {
                bio: true,
                headline: true,
                avatarUrl: true,
                addressLine1: true,
                city: true,
                country: true,
                skillsSummary: true,
              },
            },
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            employerId: true,
            city: true,
            country: true,
            location: true,
            rateAmount: true,
            currency: true,
            paymentType: true,
            startDate: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            metadata: true,
            status: true,
          },
        },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    // Cancellation fees are not applied under the current refund policy.
    const cancellationFee = 0;
    if (!app.job) throw new NotFoundException('Job not found for application');
    if (role === 'EMPLOYER') {
      if (app.job.employerId !== userId) {
        throw new ForbiddenException(
          'You can only view applications for your jobs',
        );
      }
    } else if (role === 'JOB_SEEKER') {
      if (app.applicantId !== userId) {
        throw new ForbiddenException('You can only view your own applications');
      }
    }
    // Admin can view any

    // Add payment status for employer
    if (role === 'EMPLOYER') {
      const paymentCheck =
        await this.payments.checkApplicationPayment(applicationId);

      // If there is a pending verification code version and payment is now settled,
      // rotate the code and activate the new version.
      await this.maybeRotateVerificationCodeAfterPayment(applicationId, {
        unpaidAmount: paymentCheck.unpaidAmount,
        unpaidServices: paymentCheck.unpaidServices,
        unpaidNegotiations: paymentCheck.unpaidNegotiations,
      });

      const refreshed = await this.prisma.application.findUnique({
        where: { id: applicationId },
        select: {
          verificationCode: true,
          verificationCodeVerifiedAt: true,
          verificationCodeLastVerifiedAt: true,
          verificationCodeVersion: true,
          verificationCodeVerifiedVersion: true,
          pendingVerificationCodeVersion: true,
          pendingVerificationCodeLockMode: true,
        },
      });

      const pendingLockMode =
        (refreshed?.pendingVerificationCodeLockMode as
          | 'SOFT'
          | 'HARD'
          | null
          | undefined) || null;
      const hasPending = !!refreshed?.pendingVerificationCodeVersion;
      const verificationCodeVisible =
        app.status === 'ACCEPTED' &&
        (!hasPending || pendingLockMode !== 'HARD');
      const verificationCodeMessage = hasPending
        ? pendingLockMode === 'HARD'
          ? 'Additional amounts were accepted. Please complete the outstanding payment to generate a new verification code.'
          : 'You selected new services. Please complete the payment to generate a new verification code so the service provider can work on the newly selected services.'
        : null;

      return {
        ...app,
        verificationCode: verificationCodeVisible
          ? refreshed?.verificationCode
          : null,
        verificationCodeVerifiedAt: refreshed?.verificationCodeVerifiedAt,
        verificationCodeLastVerifiedAt:
          refreshed?.verificationCodeLastVerifiedAt,
        verificationCodeVersion: refreshed?.verificationCodeVersion ?? 1,
        verificationCodeVerifiedVersion:
          refreshed?.verificationCodeVerifiedVersion ?? null,
        pendingVerificationCodeVersion:
          refreshed?.pendingVerificationCodeVersion,
        pendingVerificationCodeLockMode:
          refreshed?.pendingVerificationCodeLockMode,
        verificationCodeVisible,
        verificationCodeMessage,
        paymentStatus: {
          required: paymentCheck.paymentRequired,
          completed: paymentCheck.paymentCompleted,
          paymentId: paymentCheck.paymentId,
          paymentIntentId: paymentCheck.paymentIntentId,
          clientSecret: paymentCheck.clientSecret,
          paidAmount: paymentCheck.paidAmount, // Include paid amount from database
          unpaidAmount: paymentCheck.unpaidAmount, // Include unpaid amount
          paidSelectedRates: paymentCheck.paidSelectedRates, // Include paid selected rates
          paidNegotiationAmount: paymentCheck.paidNegotiationAmount, // Include paid negotiation amount
          paidServices: paymentCheck.paidServices, // Services marked as paid
          unpaidServices: paymentCheck.unpaidServices, // Services marked as unpaid
          paidNegotiations: paymentCheck.paidNegotiations, // Negotiations marked as paid
          unpaidNegotiations: paymentCheck.unpaidNegotiations, // Negotiations marked as unpaid
        },
        selectedRates: app.selectedRates || null,
        additionalRateRequests: app.additionalRateRequests || null,
        negotiationRequests: app.negotiationRequests || null,
      };
    }

    // For service providers (JOB_SEEKER), extract selected rates and payment status
    // Priority: application.selectedRates (always up-to-date) > payment metadata (fallback for legacy payments)
    // This ensures that when employer updates their selection, service provider sees it immediately
    let selectedRates: any[] | null = null;
    let paymentAmount: number | null = null;

    // CRITICAL: Always use app.selectedRates as the source of truth
    // If app.selectedRates is null, it means employer hasn't selected anything (or unchecked everything)
    // DO NOT fall back to payment metadata - that would show stale/old data from previous payments
    if (app.selectedRates !== null && app.selectedRates !== undefined) {
      selectedRates = app.selectedRates as any;
      // Removed verbose logging - only log in debug mode if needed
    } else {
      // selectedRates is null/undefined - employer hasn't selected anything
      // Return null (not empty array) to clearly indicate no selection
      // DO NOT fall back to payment metadata - that's old/stale data
      selectedRates = null;
      // Removed verbose logging - this is normal behavior, no need to log every request
    }

    if (app.payment?.amount) {
      paymentAmount = app.payment.amount / 100; // Convert from cents to currency units
    }

    // Get payment status for service provider to show paid/unpaid breakdown
    const paymentCheck =
      await this.payments.checkApplicationPayment(applicationId);

    return {
      ...app,
      verificationCode: null,
      selectedRates,
      paymentAmount,
      verificationCodeLastVerifiedAt:
        app.verificationCodeLastVerifiedAt ?? null,
      verificationCodeVersion: app.verificationCodeVersion ?? 1,
      verificationCodeVerifiedVersion:
        app.verificationCodeVerifiedVersion ?? null,
      pendingVerificationCodeVersion:
        app.pendingVerificationCodeVersion ?? null,
      pendingVerificationCodeLockMode:
        app.pendingVerificationCodeLockMode ?? null,
      paymentStatus: {
        required: paymentCheck.paymentRequired,
        completed: paymentCheck.paymentCompleted,
        paidAmount: paymentCheck.paidAmount, // Include paid amount from database
        unpaidAmount: paymentCheck.unpaidAmount, // Include unpaid amount
        paidServices: paymentCheck.paidServices, // Services marked as paid
        unpaidServices: paymentCheck.unpaidServices, // Services marked as unpaid
        paidNegotiations: paymentCheck.paidNegotiations, // Negotiations marked as paid
        unpaidNegotiations: paymentCheck.unpaidNegotiations, // Negotiations marked as unpaid
      },
      additionalRateRequests: app.additionalRateRequests || null,
      negotiationRequests: app.negotiationRequests || null,
    };
  }

  async listMyApplications(
    userId: string,
    opts?: { page?: number; limit?: number; status?: ApplicationStatus },
  ) {
    const page = opts?.page && opts.page > 0 ? opts.page : 1;
    const limit =
      opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
    const where: Prisma.ApplicationWhereInput = { applicantId: userId };
    if (opts?.status) {
      where.status = opts.status;
    }
    return this.prisma.application.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            city: true,
            country: true,
            location: true,
            startDate: true,
            endDate: true,
            type: true,
            workMode: true,
            category: { select: { id: true, name: true } },
            company: { select: { id: true, name: true } },
            coordinates: true,
          },
        },
      },
    });
  }

  async listEmployerApplications(
    employerId: string,
    opts?: {
      page?: number;
      limit?: number;
      status?: ApplicationStatus;
    },
  ) {
    const page = opts?.page && opts.page > 0 ? opts.page : 1;
    const limit =
      opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
    const where: Prisma.ApplicationWhereInput = { job: { employerId } };
    if (opts?.status) {
      this.validateStatus(opts.status);
      where.status = opts.status;
    }
    return this.prisma.application.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        job: { select: { id: true, title: true, isInstantBook: true } },
        applicant: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listAllApplications(opts?: {
    page?: number;
    limit?: number;
    status?: ApplicationStatus;
  }) {
    const page = opts?.page && opts.page > 0 ? opts.page : 1;
    const limit =
      opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
    const where: Prisma.ApplicationWhereInput = {};
    if (opts?.status) {
      this.validateStatus(opts.status);
      where.status = opts.status;
    }
    return this.prisma.application.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        job: { select: { id: true, title: true, employerId: true } },
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async updateStatusAsEmployer(
    employerId: string,
    applicationId: string,
    status: ApplicationStatus,
    message?: string,
  ) {
    this.validateStatus(status);
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        proposedRate: true,
        currency: true,
        selectedRates: true,
        negotiationRequests: true,
        paymentId: true,
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            stripePaymentIntentId: true,
          },
        },
        job: {
          select: {
            id: true,
            employerId: true,
            title: true,
            startDate: true,
            employer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            paymentType: true,
            rateAmount: true,
            currency: true,
            duration: true,
          },
        },
        applicant: {
          select: {
            firstName: true,
            email: true,
          },
        },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (!app.job) throw new NotFoundException('Job not found for application');

    console.log(
      `[Application Update] employerId from request: ${employerId}, job.employerId: ${app.job.employerId}`,
    );
    console.log(
      `[Application Update] IDs match: ${app.job.employerId === employerId}`,
    );

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only update applications for your jobs',
      );
    }

    // Check payment requirement for actions that require payment
    // Payment is required for: ACCEPTED and chat functionality
    const actionsRequiringPayment = ['ACCEPTED'];
    if (actionsRequiringPayment.includes(status)) {
      const paymentCheck =
        await this.payments.checkApplicationPayment(applicationId);

      // Check if there are selected services or accepted negotiations
      const selectedRates = (app.selectedRates as any) || [];
      const hasSelectedServices =
        Array.isArray(selectedRates) && selectedRates.length > 0;
      const negotiationRequests = (app.negotiationRequests as any) || [];
      const hasAcceptedNegotiation =
        Array.isArray(negotiationRequests) &&
        negotiationRequests.some((req: any) => req.status === 'ACCEPTED');

      // If services are selected or negotiations are accepted, payment must be complete
      if (hasSelectedServices || hasAcceptedNegotiation) {
        if (!paymentCheck.paymentRequired) {
          throw new BadRequestException(
            'Payment is required before you can accept the application. The selected services must be paid, or otherwise the service provider is not obligated to perform those services.',
          );
        }

        // Verify all payments are complete (including unpaid amounts)
        const paymentVerification =
          await this.payments.verifyAllPaymentsComplete(applicationId);
        if (!paymentVerification.allPaid) {
          throw new BadRequestException(
            `Cannot accept application: ${paymentVerification.message} All selected services and accepted negotiations must be fully paid before accepting.`,
          );
        }
      } else if (
        paymentCheck.paymentRequired &&
        !paymentCheck.paymentCompleted
      ) {
        throw new BadRequestException(
          'Payment is required before you can accept the application. Please complete the payment first.',
        );
      }
    }

    // Refund policy:
    // - Refund ONLY when employer explicitly rejects BEFORE the application is accepted.
    // - Never auto-refund after acceptance (manual refunds only).
    // - No refunds on withdrawal.
    const wasAccepted = app.status === 'ACCEPTED';
    const isEmployerRejecting = status === 'REJECTED';
    const hasSucceededPayment =
      app.payment && app.payment.status === PaymentStatusDb.SUCCEEDED;

    if (
      isEmployerRejecting &&
      !wasAccepted &&
      hasSucceededPayment &&
      app.payment?.amount
    ) {
      const refundAmount = app.payment.amount; // full refund
      const cancellationFee = 0;

      try {
        await this.payments.refundApplicationPayment(
          app.payment.id,
          refundAmount,
          cancellationFee,
          'Employer rejected application (pre-acceptance)',
        );
      } catch (error: any) {
        console.error('[ApplicationsService] Error processing refund:', error);
        // Continue with status update even if refund fails - log the error
      }
    }

    const updateData: any = { status };

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: updateData,
      select: { id: true, status: true },
    });

    // Update job status when application is accepted - mark as ASSIGNED
    if (status === 'ACCEPTED') {
      try {
        // Generate a 4-digit verification code for the employer
        const verificationCode = this.generate4DigitVerificationCode();

        // Update job status to ASSIGNED when employer accepts an applicant
        await this.prisma.job.update({
          where: { id: app.job.id },
          data: { status: 'ASSIGNED' },
        });

        // Update application with verification code
        await this.prisma.application.update({
          where: { id: applicationId },
          data: {
            verificationCode,
            verificationCodeVersion: 1,
            verificationCodeVerifiedVersion: null,
            pendingVerificationCodeVersion: null,
            pendingVerificationCodeLockMode: null,
          },
        });

        console.log(
          `[Job Status] Job ${app.job.id} has been set to ASSIGNED due to accepted application`,
        );
        console.log(
          `[Verification Code] Generated code ${verificationCode} for application ${applicationId}`,
        );
      } catch (err) {
        console.error(
          '[Job Status] Failed to update job status to ASSIGNED:',
          err,
        );
        // Continue even if job update fails
      }
    }

    // Create booking automatically when application is accepted
    let createdBookingId: string | null = null;
    if (status === 'ACCEPTED') {
      try {
        console.log(
          `[Booking Creation] Creating booking for application ${applicationId}, job ${app.job.id}, applicant ${app.applicantId}, employer ${app.job.employerId}`,
        );

        // Check if booking already exists for this application
        const existingBooking = await this.prisma.booking.findFirst({
          where: {
            jobId: app.job.id,
            jobSeekerId: app.applicantId,
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.IN_PROGRESS,
              ],
            },
          },
        });

        if (existingBooking) {
          console.log(
            `[Booking Creation] Booking already exists: ${existingBooking.id}`,
          );
          createdBookingId = existingBooking.id;
        } else {
          // Calculate start and end times
          // Default: start now, end in 8 hours (or parse duration from job)
          const startTime = new Date();
          let endTime = new Date(startTime.getTime() + 8 * 60 * 60 * 1000); // Default 8 hours

          // Try to parse duration from job if available
          if (app.job.duration) {
            const durationMatch = app.job.duration.match(
              /(\d+)\s*(hour|hours|day|days|week|weeks|month|months)/i,
            );
            if (durationMatch) {
              const value = parseInt(durationMatch[1], 10);
              const unit = durationMatch[2].toLowerCase();
              let hours = 8; // default
              if (unit.includes('hour')) {
                hours = value;
              } else if (unit.includes('day')) {
                hours = value * 24;
              } else if (unit.includes('week')) {
                hours = value * 24 * 7;
              } else if (unit.includes('month')) {
                hours = value * 24 * 30;
              }
              endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
            }
          }

          // Determine payment info (use proposed rate from application if available, otherwise job rate)
          const rateAmount = app.proposedRate
            ? Math.round(app.proposedRate * 100) // Convert to cents/minor units
            : app.job.rateAmount || 0;
          const currency = app.currency || app.job.currency || 'EUR';
          const paymentType =
            (app.job.paymentType as PaymentType) || PaymentType.HOURLY;

          console.log(
            `[Booking Creation] Creating booking with: jobId=${app.job.id}, jobSeekerId=${app.applicantId}, employerId=${app.job.employerId}, status=CONFIRMED, startTime=${startTime.toISOString()}, endTime=${endTime.toISOString()}`,
          );

          // Create booking
          const bookingData = {
            jobId: app.job.id,
            jobSeekerId: app.applicantId,
            employerId: app.job.employerId,
            status: BookingStatus.CONFIRMED,
            startTime,
            endTime,
            agreedPayUnit: paymentType,
            agreedRateAmount: rateAmount,
            agreedCurrency: currency,
            title: app.job.title,
            notes: `Booking created from accepted application for "${app.job.title}"`,
          };

          console.log(
            `[Booking Creation] Booking data:`,
            JSON.stringify(bookingData, null, 2),
          );

          const booking = await this.prisma.booking.create({
            data: bookingData,
          });
          createdBookingId = booking.id;
          console.log(
            `[Booking Creation] ✅ Booking created successfully: ${booking.id}`,
          );
          console.log(`[Booking Creation] Created booking details:`, {
            id: booking.id,
            jobId: booking.jobId,
            jobSeekerId: booking.jobSeekerId,
            employerId: booking.employerId,
            status: booking.status,
          });
        }
      } catch (err) {
        // Log but don't fail the request if booking creation fails
        console.error(
          '[Booking Creation] ❌ Failed to create booking for accepted application:',
          err,
        );
        if (err instanceof Error) {
          console.error(
            '[Booking Creation] Error details:',
            err.message,
            err.stack,
          );
        }
        // Also log the full error object
        console.error(
          '[Booking Creation] Full error:',
          JSON.stringify(err, Object.getOwnPropertyNames(err)),
        );
      }
    }

    // Send email notification based on status
    if (app.applicant?.email) {
      const employerName = app.job.employer
        ? `${app.job.employer.firstName || ''} ${app.job.employer.lastName || ''}`.trim() ||
          'the employer'
        : 'the employer';
      const firstName = app.applicant.firstName || 'there';
      let emailSubject = '';
      let emailHtml = '';

      if (status === 'ACCEPTED') {
        // Check if employer accepted based on negotiation only
        const selectedRates = (app.selectedRates as any) || [];
        const hasSelectedServices =
          Array.isArray(selectedRates) && selectedRates.length > 0;

        const negotiationRequests = (app.negotiationRequests as any) || [];
        const hasAcceptedNegotiation =
          Array.isArray(negotiationRequests) &&
          negotiationRequests.some((req: any) => req.status === 'ACCEPTED');

        let emailMessage = message || '';

        // If no services were selected but there's an accepted negotiation
        if (!hasSelectedServices && hasAcceptedNegotiation) {
          const acceptedNeg = negotiationRequests.find(
            (req: any) => req.status === 'ACCEPTED',
          );
          const negotiationAmount =
            acceptedNeg?.counterOffer?.status === 'ACCEPTED'
              ? acceptedNeg.counterOffer.totalAmount
              : acceptedNeg?.totalAmount || 0;
          const currency = app.currency || app.job.currency || 'EUR';

          emailMessage = `The employer has accepted your application based on the negotiated amount (${currency} ${negotiationAmount.toFixed(2)}) and did not select any of your original service offerings.${message ? `\n\nAdditional message: ${message}` : ''}`;
        }

        const t = await this.emailTranslations.getTranslatorForUser(
          app.applicantId,
        );
        emailSubject = t('email.jobs.applicationAcceptedEmailSubject', {
          jobTitle: app.job.title,
        });
        emailHtml = await this.notifications.getApplicationAcceptedHtml(
          firstName,
          app.job.title,
          employerName,
          emailMessage,
          app.applicantId,
        );
      } else if (status === 'REJECTED') {
        const rejectionMessage = message || '';
        const t = await this.emailTranslations.getTranslatorForUser(
          app.applicantId,
        );
        emailSubject = t('email.jobs.applicationRejectedEmailSubject', {
          jobTitle: app.job.title,
        });
        emailHtml = await this.notifications.getApplicationRejectedHtml(
          firstName,
          app.job.title,
          employerName,
          rejectionMessage,
          app.applicantId,
        );
      }

      if (emailSubject && emailHtml) {
        try {
          await this.notifications.sendEmail(
            app.applicant.email,
            emailSubject,
            `Your application status for "${app.job.title}" has been updated to ${status}.${message ? `\n\nMessage: ${message}` : ''}`,
            emailHtml,
          );
        } catch (err) {
          // Log but don't fail the request
          console.error('Failed to send application status email:', err);
        }
      }
    }

    // Check if employer accepted based on negotiation only (no services selected)
    let notificationBody = '';
    let notificationTitle = '';

    if (status === 'ACCEPTED') {
      const selectedRates = (app.selectedRates as any) || [];
      const hasSelectedServices =
        Array.isArray(selectedRates) && selectedRates.length > 0;

      const negotiationRequests = (app.negotiationRequests as any) || [];
      const hasAcceptedNegotiation =
        Array.isArray(negotiationRequests) &&
        negotiationRequests.some((req: any) => req.status === 'ACCEPTED');

      // If no services were selected but there's an accepted negotiation
      if (!hasSelectedServices && hasAcceptedNegotiation) {
        // Find the accepted negotiation to get the amount
        const acceptedNeg = negotiationRequests.find(
          (req: any) => req.status === 'ACCEPTED',
        );
        const negotiationAmount =
          acceptedNeg?.counterOffer?.status === 'ACCEPTED'
            ? acceptedNeg.counterOffer.totalAmount
            : acceptedNeg?.totalAmount || 0;
        const currency = app.currency || app.job.currency || 'EUR';

        const t = await this.emailTranslations.getTranslatorForUser(
          app.applicantId,
        );
        notificationTitle = t(
          'notifications.templates.applicationAcceptedTitle',
        );
        notificationBody = t(
          'notifications.templates.applicationAcceptedNegotiatedNoServicesBody',
          {
            jobTitle: app.job.title,
            currency,
            amount: negotiationAmount.toFixed(2),
          },
        );
      } else {
        const t = await this.emailTranslations.getTranslatorForUser(
          app.applicantId,
        );
        notificationTitle = t(
          'notifications.templates.applicationAcceptedTitle',
        );
        notificationBody = t(
          'notifications.templates.applicationAcceptedBody',
          {
            jobTitle: app.job.title,
          },
        );
      }
    } else if (status === 'REJECTED') {
      const t = await this.emailTranslations.getTranslatorForUser(
        app.applicantId,
      );
      notificationTitle = t('notifications.templates.applicationUpdateTitle');
      notificationBody = t('notifications.templates.applicationRejectedBody', {
        jobTitle: app.job.title,
      });
      // No cancellation fee applied
    } else {
      const t = await this.emailTranslations.getTranslatorForUser(
        app.applicantId,
      );
      notificationTitle = t('notifications.templates.applicationStatusTitle', {
        status: status.toLowerCase(),
      });
      notificationBody =
        t('notifications.templates.applicationStatusBody', {
          jobTitle: app.job.title,
          status,
        }) +
        (message
          ? `\n${t('notifications.templates.employerNotePrefix')}: ${message}`
          : '');
    }

    // Notify applicant in-app
    await this.notifications.createNotification({
      userId: app.applicantId,
      type: 'APPLICATION_UPDATE',
      title: notificationTitle,
      body: notificationBody,
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        status,
        message,
        cancellationFee: undefined,
        ...(createdBookingId ? { bookingId: createdBookingId } : {}),
      },
    });
    return { application: updated, message: 'Status updated' };
  }

  async updateStatusAsAdmin(
    applicationId: string,
    status: ApplicationStatus,
    message?: string,
  ) {
    this.validateStatus(status);
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        job: { select: { id: true, title: true } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status },
      select: { id: true, status: true },
    });
    await this.notifications.createNotification({
      userId: app.applicantId,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.applicantId)
      )('notifications.templates.applicationStatusTitle', {
        status: status.toLowerCase(),
      }),
      body:
        (await this.emailTranslations.getTranslatorForUser(app.applicantId))(
          'notifications.templates.applicationStatusBody',
          { jobTitle: app.job.title, status },
        ) +
        (message
          ? `\n${(
              await this.emailTranslations.getTranslatorForUser(app.applicantId)
            )('notifications.templates.adminNotePrefix')}: ${message}`
          : ''),
      payload: { applicationId: app.id, jobId: app.job.id, status, message },
    });
    return { application: updated, message: 'Status updated' };
  }

  private validateStatus(status: string): asserts status is ApplicationStatus {
    const allowed: ApplicationStatus[] = [
      'PENDING',
      'REVIEWING',
      'SHORTLISTED',
      'ACCEPTED',
      'REJECTED',
      'WITHDRAWN',
    ];
    if (!allowed.includes(status as ApplicationStatus)) {
      throw new BadRequestException('Invalid status');
    }
  }

  /**
   * Check if cancellation is within 1 day of job start date
   */
  private isCancellationWithinOneDay(
    jobStartDate: Date | null | undefined,
  ): boolean {
    if (!jobStartDate) return false;
    const now = new Date();
    const oneDayInMs = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    const timeUntilStart = jobStartDate.getTime() - now.getTime();
    return timeUntilStart > 0 && timeUntilStart <= oneDayInMs;
  }

  /**
   * Calculate cancellation fee (10% of payment amount)
   */
  private calculateCancellationFee(amount: number): number {
    return Math.round(amount * 0.1); // 10% fee
  }

  async withdrawAsSeeker(
    userId: string,
    applicationId: string,
    reason: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        paymentId: true,
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            stripePaymentIntentId: true,
          },
        },
        applicant: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        job: {
          select: {
            id: true,
            employerId: true,
            title: true,
            startDate: true,
            employer: {
              select: {
                email: true,
                firstName: true,
              },
            },
          },
        },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.applicantId !== userId) {
      throw new ForbiddenException(
        'You can only withdraw your own application',
      );
    }
    if (app.status === 'WITHDRAWN') {
      return {
        application: { id: app.id, status: app.status },
        message: 'Already withdrawn',
      };
    }

    // Refund policy: no refunds on applicant withdrawal.

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'WITHDRAWN',
        withdrawalReason: reason,
        // Store cancellation fee info in metadata if needed
      },
      select: { id: true, status: true },
    });

    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;
    const employer = app.job.employer;

    let notificationBody = `${applicantName} can no longer make it to "${jobTitle}". Reason: ${reason}`;

    // Create in-app notification
    await this.notifications.createNotification({
      userId: app.job.employerId,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.applicationWithdrawnTitle'),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.applicationWithdrawnBody', {
        applicantName,
        jobTitle,
        reason,
      }),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        status: 'WITHDRAWN',
        cancellationFee: undefined,
      },
    });

    // Send push notification
    await this.notifications.sendPushNotification(
      app.job.employerId,
      (await this.emailTranslations.getTranslatorForUser(app.job.employerId))(
        'notifications.templates.applicationWithdrawnTitle',
      ),
      (await this.emailTranslations.getTranslatorForUser(app.job.employerId))(
        'notifications.templates.applicationWithdrawnPushBody',
        { applicantName, jobTitle },
      ),
      {
        type: 'APPLICATION_UPDATE',
        applicationId: app.id,
        jobId: app.job.id,
      },
    );

    // Send email notification
    const t = await this.emailTranslations.getTranslatorForUser(
      app.job.employerId,
    );
    const language = await this.emailTranslations.getUserLanguage(
      app.job.employerId,
    );
    const employerName = employer.firstName || t('email.common.there');

    const emailSubject = t('email.jobs.applicationWithdrawnSubject', {
      jobTitle,
    });
    const emailText = t('email.jobs.applicationWithdrawnText', {
      employerName,
      applicantName,
      jobTitle,
      reason,
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">${t('email.jobs.applicationWithdrawnTitle')}</h2>
        <p>${t('email.jobs.greeting', { employerName })}</p>
        <p>${t('email.jobs.applicationWithdrawnMessage', { applicantName, jobTitle })}</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>${t('email.jobs.reason')}:</strong> ${reason}</p>
        </div>
        <p>${t('email.jobs.applicationWithdrawnBrowse')}</p>
        <p>${t('email.common.bestRegards')}<br>${t('email.common.cumpridoTeam')}</p>
      </body>
      </html>
    `;

    await this.notifications.sendEmail(
      employer.email,
      emailSubject,
      emailText,
      emailHtml,
    );

    return { application: updated, message: 'Application withdrawn' };
  }

  /**
   * Reset job status to ACTIVE if payment becomes incomplete
   * This enforces that jobs cannot remain in ASSIGNED status if payment is incomplete
   * When reset, paid amounts are captured as platform revenue (non-refundable)
   */
  private async resetJobStatusIfPaymentIncomplete(
    applicationId: string,
    jobId: string,
  ): Promise<void> {
    try {
      // Check if payment is incomplete
      const paymentVerification =
        await this.payments.verifyAllPaymentsComplete(applicationId);

      if (!paymentVerification.allPaid) {
        // Get current job status and application with payment
        const job = await this.prisma.job.findUnique({
          where: { id: jobId },
          select: { id: true, status: true },
        });

        const application = await this.prisma.application.findUnique({
          where: { id: applicationId },
          include: {
            payment: {
              select: {
                id: true,
                amount: true,
                status: true,
                stripePaymentIntentId: true,
              },
            },
          },
        });

        // Only reset if job is ASSIGNED or COMPLETED (not if it's already ACTIVE)
        if (job && (job.status === 'ASSIGNED' || job.status === 'COMPLETED')) {
          // If there's a paid amount, capture it as platform revenue (non-refundable)
          if (
            application?.payment &&
            application.payment.amount &&
            application.payment.amount > 0
          ) {
            try {
              await this.payments.capturePaidAmountAsPlatformRevenue(
                applicationId,
                application.payment.id,
                application.payment.amount,
                'Job reset due to incomplete payment - non-refundable per policy',
              );
              console.log(
                `[Payment Enforcement] Captured paid amount ${application.payment.amount} as platform revenue (non-refundable) for job ${jobId} reset.`,
              );
            } catch (err) {
              console.error(
                `[Payment Enforcement] Failed to capture paid amount as platform revenue: ${err}`,
              );
              // Continue with reset even if capture fails
            }
          }

          // Reset job status to ACTIVE
          await this.prisma.job.update({
            where: { id: jobId },
            data: { status: 'ACTIVE' },
          });

          if (application && application.status === 'ACCEPTED') {
            // Don't reset to PENDING, but log a warning
            // The application stays ACCEPTED but job is reset to ACTIVE
            console.log(
              `[Payment Enforcement] Job ${jobId} reset to ACTIVE due to incomplete payment. Application ${applicationId} remains ACCEPTED but service provider is not obligated until payment is complete.`,
            );
          }

          console.log(
            `[Payment Enforcement] Job ${jobId} has been reset to ACTIVE status due to incomplete payment. Unpaid amount: ${paymentVerification.unpaidAmount.toFixed(2)}`,
          );
        }
      }
    } catch (err) {
      console.error(`[Payment Enforcement] Failed to reset job status: ${err}`);
      // Don't throw - this is a background enforcement check
    }
  }

  /**
   * Employer updates selected rates for an application (before payment)
   */
  async updateSelectedRates(
    employerId: string,
    applicationId: string,
    selectedRates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        selectedRates: true,
        pendingVerificationCodeVersion: true,
        pendingVerificationCodeLockMode: true,
        job: {
          select: {
            id: true,
            employerId: true,
            status: true,
          },
        },
      },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only update selected rates for your own job applications',
      );
    }

    // Removed verbose logging - only log errors or important state changes

    // Update selected rates
    // IMPORTANT: If selectedRates is empty array, set to null to clear old data
    // This ensures that when employer unchecks all services, old data is cleared
    const previousSelectedRates = (app.selectedRates as any) || [];
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        selectedRates: selectedRates.length > 0 ? (selectedRates as any) : null,
      },
    });

    // Removed verbose logging

    // CRITICAL: Check if payment is now incomplete after adding services
    // If application is ACCEPTED and new services are added, verify payment
    if (app.status === 'ACCEPTED' && selectedRates.length > 0) {
      // Check if payment covers all selected services
      await this.resetJobStatusIfPaymentIncomplete(applicationId, app.job.id);
    }

    // Post-acceptance: code versioning lock for newly selected services.
    // Soft-lock (code still visible) but prompt employer to pay for a new code.
    if (app.status === 'ACCEPTED') {
      const prevKeys = new Set(
        Array.isArray(previousSelectedRates)
          ? previousSelectedRates.map((r: any) => this.normalizeRateKey(r))
          : [],
      );
      const nextKeys = new Set(
        Array.isArray(selectedRates)
          ? selectedRates.map((r: any) => this.normalizeRateKey(r))
          : [],
      );
      const hasAddedNewService = Array.from(nextKeys).some(
        (k) => !prevKeys.has(k),
      );

      const paymentCheck =
        await this.payments.checkApplicationPayment(applicationId);
      const hasUnpaidItems =
        paymentCheck.unpaidAmount > 0.01 ||
        (paymentCheck.unpaidServices?.length ?? 0) > 0 ||
        (paymentCheck.unpaidNegotiations?.length ?? 0) > 0;

      if (hasAddedNewService && hasUnpaidItems) {
        await this.ensurePendingVerificationCode(applicationId, 'SOFT');
      } else {
        // If this was a soft-lock scenario and employer removed the additions (no unpaid), clear pending.
        if (app.pendingVerificationCodeLockMode === 'SOFT' && !hasUnpaidItems) {
          await this.clearSoftPendingVerificationCodeIfAny(applicationId);
        }
      }
    }

    // Removed verbose logging

    return {
      application: {
        id: updated.id,
        selectedRates: updated.selectedRates,
      },
      message: 'Selected rates updated',
    };
  }

  /**
   * Service provider requests additional rates for an application
   */
  async requestAdditionalRates(
    applicantId: string,
    applicationId: string,
    rates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>,
    totalAmount: number,
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        additionalRateRequests: true,
        applicant: { select: { id: true, firstName: true, lastName: true } },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You can only request additional rates for your own applications',
      );
    }

    // Validate total amount matches sum of rates
    const calculatedTotal = rates.reduce((sum, rate) => sum + rate.rate, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      throw new BadRequestException(
        'Total amount does not match the sum of rates',
      );
    }

    // Get existing requests or initialize
    const existingRequests = (app.additionalRateRequests as any) || [];

    // Create new request
    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rates,
      totalAmount,
      status: 'PENDING' as const,
      requestedAt: new Date().toISOString(),
      message: message || undefined,
    };

    // Add to requests array
    const updatedRequests = [...existingRequests, newRequest];

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        additionalRateRequests: updatedRequests as any,
      },
    });

    // Send notification to employer
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;
    const employer = app.job.employer;

    // Create notification
    await this.notifications.createNotification({
      userId: employer.id,
      type: 'APPLICATION_UPDATE',
      title: (await this.emailTranslations.getTranslatorForUser(employer.id))(
        'notifications.templates.additionalRatesRequestedTitle',
      ),
      body: (await this.emailTranslations.getTranslatorForUser(employer.id))(
        'notifications.templates.additionalRatesRequestedBody',
        {
          applicantName,
          jobTitle,
          currency: (app.job.currency?.toUpperCase() || 'EUR') as string,
          totalAmount: totalAmount.toFixed(2),
        },
      ),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId: newRequest.id,
        totalAmount,
        rates,
      },
    });

    // Send email notification
    try {
      const emailSubject = `Additional Rates Requested - ${jobTitle}`;
      const emailText = `Hello ${employer.firstName || 'there'},\n\n${applicantName} has requested additional rates for the job "${jobTitle}".\n\nRequested Amount: ${app.job.currency?.toUpperCase() || 'EUR'} ${totalAmount.toFixed(2)}\n${message ? `Message: ${message}\n` : ''}\nPlease review and respond to this request in your application dashboard.`;
      const emailHtml = `
        <h2>Additional Rates Requested</h2>
        <p>Hello ${employer.firstName || 'there'},</p>
        <p>${applicantName} has requested additional rates for the job "${jobTitle}".</p>
        <p><strong>Requested Amount:</strong> ${app.job.currency?.toUpperCase() || 'EUR'} ${totalAmount.toFixed(2)}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        <p>Please review and respond to this request in your application dashboard.</p>
      `;
      await this.notifications.sendEmail(
        employer.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Don't fail the request if email fails
    }

    return newRequest;
  }

  /**
   * Employer responds to additional rates request
   */
  async respondToAdditionalRates(
    employerId: string,
    applicationId: string,
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        additionalRateRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
          },
        },
      },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only respond to additional rates for your own job applications',
      );
    }

    const requests = (app.additionalRateRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Additional rates request not found');
    }

    const request = requests[requestIndex];
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This request has already been responded to',
      );
    }

    // Update request
    requests[requestIndex] = {
      ...request,
      status,
      respondedAt: new Date().toISOString(),
      responseMessage: message || undefined,
    };

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        additionalRateRequests: requests as any,
      },
    });

    // Post-acceptance: if additional rates are approved, hard-lock verification code until paid.
    if (status === 'APPROVED' && app.status === 'ACCEPTED') {
      await this.ensurePendingVerificationCode(applicationId, 'HARD');
    }

    // Send notification to service provider
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.applicant.id,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )(
        status === 'APPROVED'
          ? 'notifications.templates.additionalRatesApprovedTitle'
          : 'notifications.templates.additionalRatesRejectedTitle',
      ),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )(
        status === 'APPROVED'
          ? 'notifications.templates.additionalRatesApprovedBody'
          : 'notifications.templates.additionalRatesRejectedBody',
        { jobTitle },
      ),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId,
        status,
      },
    });

    // Send email notification
    try {
      const emailSubject = `Additional Rates ${status === 'APPROVED' ? 'Approved' : 'Rejected'} - ${jobTitle}`;
      const emailText = `Hello ${applicantName},\n\nYour additional rates request for the job "${jobTitle}" has been ${status.toLowerCase()}.\n${message ? `Message from employer: ${message}\n` : ''}${status === 'APPROVED' ? 'The employer will proceed with the updated payment amount.\n' : ''}`;
      const emailHtml = `
        <h2>Additional Rates ${status === 'APPROVED' ? 'Approved' : 'Rejected'}</h2>
        <p>Hello ${applicantName},</p>
        <p>Your additional rates request for the job "${jobTitle}" has been <strong>${status.toLowerCase()}</strong>.</p>
        ${message ? `<p><strong>Message from employer:</strong> ${message}</p>` : ''}
        ${status === 'APPROVED' ? `<p>The employer will proceed with the updated payment amount.</p>` : ''}
      `;
      await this.notifications.sendEmail(
        app.applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return requests[requestIndex];
  }

  /**
   * Employer suggests negotiation rates for an application
   */
  async suggestNegotiation(
    employerId: string,
    applicationId: string,
    rates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>,
    totalAmount: number,
    message: string, // Mandatory message
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        negotiationRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only suggest negotiations for your own job applications',
      );
    }

    // Validate total amount matches sum of rates
    const calculatedTotal = rates.reduce((sum, rate) => sum + rate.rate, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      throw new BadRequestException(
        'Total amount does not match the sum of rates',
      );
    }

    // Validate message is not empty
    if (!message || message.trim().length === 0) {
      throw new BadRequestException(
        'Message is required to explain the negotiation',
      );
    }

    // Get existing requests or initialize
    const existingRequests = (app.negotiationRequests as any) || [];

    // Create new negotiation request
    const newRequest = {
      id: `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rates,
      totalAmount,
      status: 'PENDING' as const,
      suggestedAt: new Date().toISOString(),
      message: message.trim(),
      suggestedByRole: 'EMPLOYER' as const,
    };

    // Add to requests array
    const updatedRequests = [...existingRequests, newRequest];

    // Update application
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: updatedRequests as any,
      },
      select: {
        id: true,
        negotiationRequests: true,
      },
    });

    // Send notification to service provider
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.applicant.id,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )('notifications.templates.negotiationSuggestionTitle'),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )('notifications.templates.negotiationSuggestionBody', { jobTitle }),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId: newRequest.id,
      },
    });

    // Send email notification
    try {
      const emailSubject = `Negotiation Suggestion - ${jobTitle}`;
      const emailText = `Hello ${applicantName},\n\nThe employer has suggested a negotiation for the job "${jobTitle}".\n\nSuggested Amount: ${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}\nMessage: ${message}\n\nPlease review and respond to this negotiation suggestion.`;
      const emailHtml = `
        <h2>Negotiation Suggestion</h2>
        <p>Hello ${applicantName},</p>
        <p>The employer has suggested a negotiation for the job "<strong>${jobTitle}</strong>".</p>
        <p><strong>Suggested Amount:</strong> ${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}</p>
        <p><strong>Message from employer:</strong></p>
        <p>${message}</p>
        <p>Please review and respond to this negotiation suggestion.</p>
      `;
      await this.notifications.sendEmail(
        app.applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    console.log(`[ApplicationsService] Negotiation suggested by employer:`, {
      applicationId: app.id,
      employerId,
      requestId: newRequest.id,
      totalAmount,
      ratesCount: rates.length,
    });

    return {
      application: updated,
      request: newRequest,
      message: 'Negotiation suggestion sent',
    };
  }

  /**
   * Service provider requests a negotiation for an application
   */
  async requestNegotiation(
    applicantId: string,
    applicationId: string,
    rates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>,
    totalAmount: number,
    message: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        negotiationRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You can only request negotiations for your own applications',
      );
    }

    const calculatedTotal = rates.reduce((sum, rate) => sum + rate.rate, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      throw new BadRequestException(
        'Total amount does not match the sum of rates',
      );
    }

    if (!message || message.trim().length === 0) {
      throw new BadRequestException(
        'Message is required to explain the negotiation',
      );
    }

    const existingRequests = (app.negotiationRequests as any) || [];

    const newRequest = {
      id: `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rates,
      totalAmount,
      status: 'PENDING' as const,
      suggestedAt: new Date().toISOString(),
      message: message.trim(),
      suggestedByRole: 'JOB_SEEKER' as const,
    };

    const updatedRequests = [...existingRequests, newRequest];

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: updatedRequests as any,
      },
      select: {
        id: true,
        negotiationRequests: true,
      },
    });

    const jobTitle = app.job.title;
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;

    await this.notifications.createNotification({
      userId: app.job.employerId,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.negotiationRequestedTitle'),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.negotiationRequestedBody', {
        applicantName,
        jobTitle,
      }),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId: newRequest.id,
      },
    });

    try {
      const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
      const emailSubject = `Negotiation Requested - ${jobTitle}`;
      const emailText = `Hello ${employerName},\n\n${applicantName} has requested a negotiation for the job "${jobTitle}".\n\nRequested Amount: ${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}\nMessage: ${message}\n\nPlease review and respond.`;

      // Format rates for display
      const ratesList = rates
        .map((rate, idx) => {
          const paymentTypeLabel =
            rate.paymentType === 'OTHER' && rate.otherSpecification
              ? rate.otherSpecification
              : rate.paymentType.charAt(0) +
                rate.paymentType.slice(1).toLowerCase().replace('_', ' ');
          return `${idx + 1}. ${app.job.currency || 'EUR'} ${rate.rate.toFixed(2)} per ${paymentTypeLabel}`;
        })
        .join('<br>');

      const content = `
        <p style="margin: 0 0 20px;"><strong>${applicantName}</strong> has requested a negotiation for the job "<strong>${jobTitle}</strong>".</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #6366f1;">
          <p style="margin: 0 0 12px; color: #1f2937; font-weight: 600; font-size: 15px;">Requested Rates:</p>
          <div style="color: #4b5563; font-size: 15px; line-height: 1.8;">
            ${ratesList}
          </div>
          <p style="margin: 16px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">Total Amount:</strong> 
            <span style="color: #6366f1; font-weight: 700; font-size: 18px;">${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}</span>
          </p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px; color: #92400e; font-weight: 600; font-size: 14px;">Message from Service Provider:</p>
          <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        
        <p style="margin: 24px 0 0; color: #4b5563; font-size: 16px;">Please review the request and respond accordingly.</p>
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        'Negotiation Requested',
        `Hello ${employerName},`,
        content,
        'You can accept, reject, or make a counter offer to this negotiation request.',
      );

      await this.notifications.sendEmail(
        app.job.employer.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      application: updated,
      request: newRequest,
      message: 'Negotiation request sent',
    };
  }

  /**
   * Service provider responds to negotiation suggestion
   */
  async respondToNegotiation(
    applicantId: string,
    applicationId: string,
    requestId: string,
    status: 'ACCEPTED' | 'REJECTED',
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        negotiationRequests: true,
        applicant: { select: { id: true, firstName: true, lastName: true } },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You can only respond to negotiations for your own applications',
      );
    }

    const requests = (app.negotiationRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Negotiation request not found');
    }

    const request = requests[requestIndex];

    const suggestedByRole = request.suggestedByRole ?? 'EMPLOYER';
    if (suggestedByRole !== 'EMPLOYER') {
      throw new BadRequestException(
        'This negotiation request must be responded to by the employer',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This negotiation has already been responded to',
      );
    }

    // Update request
    requests[requestIndex] = {
      ...request,
      status,
      respondedAt: new Date().toISOString(),
      responseMessage: message || undefined,
    };

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: requests as any,
      },
    });

    // Post-acceptance: if negotiation is accepted, hard-lock verification code until paid.
    if (status === 'ACCEPTED' && app.status === 'ACCEPTED') {
      await this.ensurePendingVerificationCode(applicationId, 'HARD');
    }

    // Send notification to employer
    const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.job.employerId,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )(
        status === 'ACCEPTED'
          ? 'notifications.templates.negotiationAcceptedTitle'
          : 'notifications.templates.negotiationRejectedTitle',
      ),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )(
        status === 'ACCEPTED'
          ? 'notifications.templates.negotiationEmployerSuggestionAcceptedBody'
          : 'notifications.templates.negotiationEmployerSuggestionRejectedBody',
        { jobTitle },
      ),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId,
        status,
      },
    });

    // Send email notification
    try {
      const emailSubject = `Negotiation ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'} - ${jobTitle}`;
      const emailText = `Hello ${employerName},\n\nThe service provider has ${status.toLowerCase()} your negotiation suggestion for the job "${jobTitle}".\n${message ? `Response message: ${message}\n` : ''}${status === 'ACCEPTED' ? 'You can proceed with the updated payment amount.\n' : ''}`;

      const statusColor = status === 'ACCEPTED' ? '#10b981' : '#ef4444';
      const statusBg = status === 'ACCEPTED' ? '#d1fae5' : '#fee2e2';
      const statusText = status === 'ACCEPTED' ? '#065f46' : '#991b1b';

      const content = `
        <div style="background-color: ${statusBg}; padding: 20px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid ${statusColor};">
          <p style="margin: 0; color: ${statusText}; font-weight: 600; font-size: 16px;">
            The service provider has <strong>${status.toLowerCase()}</strong> your negotiation suggestion for the job "<strong>${jobTitle}</strong>".
          </p>
        </div>
        ${
          message
            ? `
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid #6366f1;">
          <p style="margin: 0 0 8px; color: #1f2937; font-weight: 600; font-size: 14px;">Response Message:</p>
          <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        `
            : ''
        }
        ${status === 'ACCEPTED' ? '<p style="margin: 0; color: #4b5563; font-size: 16px;">You can proceed with the updated payment amount.</p>' : ''}
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        `Negotiation ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}`,
        `Hello ${employerName},`,
        content,
        status === 'ACCEPTED'
          ? 'The negotiation has been accepted. You can now proceed with the updated payment amount.'
          : 'The negotiation has been rejected. You may want to discuss alternative terms with the service provider.',
      );

      await this.notifications.sendEmail(
        app.job.employer.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    console.log(
      `[ApplicationsService] Negotiation responded by service provider:`,
      {
        applicationId: app.id,
        applicantId,
        requestId,
        status,
      },
    );

    return requests[requestIndex];
  }

  /**
   * Employer responds to a negotiation requested by the service provider
   */
  async respondToNegotiationAsEmployer(
    employerId: string,
    applicationId: string,
    requestId: string,
    status: 'ACCEPTED' | 'REJECTED',
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        negotiationRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only respond to negotiations for your own job applications',
      );
    }

    const requests = (app.negotiationRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Negotiation request not found');
    }

    const request = requests[requestIndex];
    const suggestedByRole = request.suggestedByRole ?? 'EMPLOYER';
    if (suggestedByRole !== 'JOB_SEEKER') {
      throw new BadRequestException(
        'This negotiation request must be responded to by the service provider',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This negotiation has already been responded to',
      );
    }

    requests[requestIndex] = {
      ...request,
      status,
      respondedAt: new Date().toISOString(),
      responseMessage: message || undefined,
    };

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: requests as any,
      },
    });

    // Post-acceptance: if negotiation is accepted, hard-lock verification code until paid.
    if (status === 'ACCEPTED' && app.status === 'ACCEPTED') {
      await this.ensurePendingVerificationCode(applicationId, 'HARD');
    }

    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;
    const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;

    await this.notifications.createNotification({
      userId: app.applicant.id,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )(
        status === 'ACCEPTED'
          ? 'notifications.templates.negotiationAcceptedTitle'
          : 'notifications.templates.negotiationRejectedTitle',
      ),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )(
        status === 'ACCEPTED'
          ? 'notifications.templates.negotiationSeekerRequestAcceptedBody'
          : 'notifications.templates.negotiationSeekerRequestRejectedBody',
        { jobTitle },
      ),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId,
        status,
      },
    });

    try {
      const emailSubject = `Negotiation ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'} - ${jobTitle}`;
      const emailText = `Hello ${applicantName},\n\nThe employer has ${status.toLowerCase()} your negotiation request for the job "${jobTitle}".\n${message ? `Response message: ${message}\n` : ''}${status === 'ACCEPTED' ? 'The employer will proceed with the updated payment amount.\n' : ''}`;

      const statusColor = status === 'ACCEPTED' ? '#10b981' : '#ef4444';
      const statusBg = status === 'ACCEPTED' ? '#d1fae5' : '#fee2e2';
      const statusText = status === 'ACCEPTED' ? '#065f46' : '#991b1b';

      const content = `
        <div style="background-color: ${statusBg}; padding: 20px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid ${statusColor};">
          <p style="margin: 0; color: ${statusText}; font-weight: 600; font-size: 16px;">
            <strong>${employerName}</strong> has <strong>${status.toLowerCase()}</strong> your negotiation request for the job "<strong>${jobTitle}</strong>".
          </p>
        </div>
        ${
          message
            ? `
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid #6366f1;">
          <p style="margin: 0 0 8px; color: #1f2937; font-weight: 600; font-size: 14px;">Response Message:</p>
          <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        `
            : ''
        }
        ${status === 'ACCEPTED' ? '<p style="margin: 0; color: #4b5563; font-size: 16px;">The employer will proceed with the updated payment amount.</p>' : ''}
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        `Negotiation ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}`,
        `Hello ${applicantName},`,
        content,
        status === 'ACCEPTED'
          ? 'Your negotiation has been accepted. The employer will proceed with the updated payment amount.'
          : 'Your negotiation has been rejected. You may want to discuss alternative terms with the employer.',
      );

      await this.notifications.sendEmail(
        app.applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return requests[requestIndex];
  }

  async counterOfferNegotiation(
    applicantId: string,
    applicationId: string,
    requestId: string,
    rates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>,
    totalAmount: number,
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    // Validate totalAmount matches rates sum
    const ratesSum = rates.reduce((sum, r) => sum + r.rate, 0);
    if (Math.abs(ratesSum - totalAmount) > 0.01) {
      throw new BadRequestException(
        'Total amount does not match the sum of rates',
      );
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        negotiationRequests: true,
        applicant: { select: { id: true, firstName: true, lastName: true } },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You can only send counter offers for your own applications',
      );
    }

    const requests = (app.negotiationRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Negotiation request not found');
    }

    const request = requests[requestIndex];
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This negotiation has already been responded to',
      );
    }

    // Create counter offer object
    const counterOffer = {
      id: `counter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      rates,
      totalAmount,
      message: message || undefined,
      suggestedAt: new Date().toISOString(),
      status: 'PENDING' as const,
      type: 'COUNTER_OFFER' as const,
      originalRequestId: requestId,
    };

    // Update request to include counter offer
    requests[requestIndex] = {
      ...request,
      counterOffer,
      status: 'COUNTER_OFFERED',
      respondedAt: new Date().toISOString(),
    };

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: requests as any,
      },
    });

    // Send notification to employer
    const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.job.employerId,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.counterOfferReceivedTitle'),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.counterOfferFromSeekerBody', { jobTitle }),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId,
        counterOfferId: counterOffer.id,
      },
    });

    // Send email notification
    try {
      const emailSubject = `Counter Offer Received - ${jobTitle}`;
      const emailText = `Hello ${employerName},\n\nThe service provider has sent a counter offer for your negotiation suggestion on the job "${jobTitle}".\n\nCounter Offer Amount: ${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}\n${message ? `Message: ${message}\n` : ''}Please review and respond to the counter offer.`;

      // Format rates for display
      const ratesList = rates
        .map((rate, idx) => {
          const paymentTypeLabel =
            rate.paymentType === 'OTHER' && rate.otherSpecification
              ? rate.otherSpecification
              : rate.paymentType.charAt(0) +
                rate.paymentType.slice(1).toLowerCase().replace('_', ' ');
          return `${idx + 1}. ${app.job.currency || 'EUR'} ${rate.rate.toFixed(2)} per ${paymentTypeLabel}`;
        })
        .join('<br>');

      const content = `
        <p style="margin: 0 0 20px;">The service provider has sent a counter offer for your negotiation suggestion on the job "<strong>${jobTitle}</strong>".</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #6366f1;">
          <p style="margin: 0 0 12px; color: #1f2937; font-weight: 600; font-size: 15px;">Counter Offer Rates:</p>
          <div style="color: #4b5563; font-size: 15px; line-height: 1.8;">
            ${ratesList}
          </div>
          <p style="margin: 16px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">Total Amount:</strong> 
            <span style="color: #6366f1; font-weight: 700; font-size: 18px;">${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}</span>
          </p>
        </div>
        
        ${
          message
            ? `
        <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px; color: #92400e; font-weight: 600; font-size: 14px;">Message from Service Provider:</p>
          <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        `
            : ''
        }
        
        <p style="margin: 24px 0 0; color: #4b5563; font-size: 16px;">Please review and respond to the counter offer.</p>
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        'Counter Offer Received',
        `Hello ${employerName},`,
        content,
        'You can accept, reject, or make another counter offer to this proposal.',
      );

      await this.notifications.sendEmail(
        app.job.employer.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: 'Counter offer sent successfully',
      counterOffer,
    };
  }

  /**
   * Employer makes a counter offer to a service provider's negotiation request
   */
  async counterOfferNegotiationAsEmployer(
    employerId: string,
    applicationId: string,
    requestId: string,
    rates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>,
    totalAmount: number,
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    // Validate totalAmount matches rates sum
    const ratesSum = rates.reduce((sum, r) => sum + r.rate, 0);
    if (Math.abs(ratesSum - totalAmount) > 0.01) {
      throw new BadRequestException(
        'Total amount does not match the sum of rates',
      );
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        negotiationRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only send counter offers for your own job applications',
      );
    }

    const requests = (app.negotiationRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Negotiation request not found');
    }

    const request = requests[requestIndex];
    const suggestedByRole = request.suggestedByRole ?? 'JOB_SEEKER';
    if (suggestedByRole !== 'JOB_SEEKER') {
      throw new BadRequestException(
        'This negotiation request must be responded to by the employer',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This negotiation has already been responded to',
      );
    }

    // Create counter offer object
    const counterOffer = {
      id: `counter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      rates,
      totalAmount,
      message: message || undefined,
      suggestedAt: new Date().toISOString(),
      status: 'PENDING' as const,
      type: 'COUNTER_OFFER' as const,
      originalRequestId: requestId,
    };

    // Update request to include counter offer
    requests[requestIndex] = {
      ...request,
      counterOffer,
      status: 'COUNTER_OFFERED',
      respondedAt: new Date().toISOString(),
    };

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: requests as any,
      },
    });

    // Send notification to service provider
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.applicant.id,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )('notifications.templates.counterOfferReceivedTitle'),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )('notifications.templates.counterOfferFromEmployerBody', { jobTitle }),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId,
        counterOfferId: counterOffer.id,
      },
    });

    // Send email notification
    try {
      const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
      const emailSubject = `Counter Offer Received - ${jobTitle}`;
      const emailText = `Hello ${applicantName},\n\nThe employer has sent a counter offer for your negotiation request on the job "${jobTitle}".\n\nCounter Offer Amount: ${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}\n${message ? `Message: ${message}\n` : ''}Please review and respond to the counter offer.`;

      // Format rates for display
      const ratesList = rates
        .map((rate, idx) => {
          const paymentTypeLabel =
            rate.paymentType === 'OTHER' && rate.otherSpecification
              ? rate.otherSpecification
              : rate.paymentType.charAt(0) +
                rate.paymentType.slice(1).toLowerCase().replace('_', ' ');
          return `${idx + 1}. ${app.job.currency || 'EUR'} ${rate.rate.toFixed(2)} per ${paymentTypeLabel}`;
        })
        .join('<br>');

      const content = `
        <p style="margin: 0 0 20px;"><strong>${employerName}</strong> has sent a counter offer for your negotiation request on the job "<strong>${jobTitle}</strong>".</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #6366f1;">
          <p style="margin: 0 0 12px; color: #1f2937; font-weight: 600; font-size: 15px;">Counter Offer Rates:</p>
          <div style="color: #4b5563; font-size: 15px; line-height: 1.8;">
            ${ratesList}
          </div>
          <p style="margin: 16px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">Total Amount:</strong> 
            <span style="color: #6366f1; font-weight: 700; font-size: 18px;">${app.job.currency || 'EUR'} ${totalAmount.toFixed(2)}</span>
          </p>
        </div>
        
        ${
          message
            ? `
        <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px; color: #92400e; font-weight: 600; font-size: 14px;">Message from Employer:</p>
          <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        `
            : ''
        }
        
        <p style="margin: 24px 0 0; color: #4b5563; font-size: 16px;">Please review and respond to the counter offer.</p>
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        'Counter Offer Received',
        `Hello ${applicantName},`,
        content,
        'You can accept, reject, or make another counter offer to this proposal.',
      );

      await this.notifications.sendEmail(
        app.applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: 'Counter offer sent successfully',
      counterOffer,
    };
  }

  async respondToCounterOffer(
    employerId: string,
    applicationId: string,
    requestId: string,
    counterOfferId: string,
    status: 'ACCEPTED' | 'REJECTED',
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        negotiationRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only respond to counter offers for your own job applications',
      );
    }

    const requests = (app.negotiationRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Negotiation request not found');
    }

    const request = requests[requestIndex];
    if (!request.counterOffer || request.counterOffer.id !== counterOfferId) {
      throw new NotFoundException('Counter offer not found');
    }

    if (request.counterOffer.status !== 'PENDING') {
      throw new BadRequestException(
        'This counter offer has already been responded to',
      );
    }

    // Update counter offer status
    const updatedCounterOffer = {
      ...request.counterOffer,
      status,
      respondedAt: new Date().toISOString(),
      responseMessage: message || undefined,
    };

    // If accepted, update the negotiation request to use counter offer rates
    if (status === 'ACCEPTED') {
      requests[requestIndex] = {
        ...request,
        counterOffer: updatedCounterOffer,
        status: 'ACCEPTED',
        rates: request.counterOffer.rates, // Use counter offer rates
        totalAmount: request.counterOffer.totalAmount, // Use counter offer total
        respondedAt: new Date().toISOString(),
        responseMessage: message || undefined,
      };
    } else {
      // If rejected, just update counter offer status
      requests[requestIndex] = {
        ...request,
        counterOffer: updatedCounterOffer,
      };
    }

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: requests as any,
      },
    });

    // Post-acceptance: if counter offer is accepted, hard-lock verification code until paid.
    if (status === 'ACCEPTED' && app.status === 'ACCEPTED') {
      await this.ensurePendingVerificationCode(applicationId, 'HARD');
    }

    // Send notification to service provider
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.applicant.id,
      type: 'APPLICATION_UPDATE',
      title:
        status === 'ACCEPTED'
          ? 'Counter Offer Accepted'
          : 'Counter Offer Rejected',
      body:
        status === 'ACCEPTED'
          ? `The employer has accepted your counter offer for "${jobTitle}".`
          : `The employer has rejected your counter offer for "${jobTitle}".`,
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId,
        counterOfferId,
        status,
      },
    });

    // Send email notification
    try {
      const emailSubject = `Counter Offer ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'} - ${jobTitle}`;
      const emailText = `Hello ${applicantName},\n\nThe employer has ${status.toLowerCase()} your counter offer for the job "${jobTitle}".\n${message ? `Response message: ${message}\n` : ''}${status === 'ACCEPTED' ? 'The counter offer rates have been accepted and will be included in the payment.\n' : ''}`;
      const emailHtml = `
        <h2>Counter Offer ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}</h2>
        <p>Hello ${applicantName},</p>
        <p>The employer has <strong>${status.toLowerCase()}</strong> your counter offer for the job "<strong>${jobTitle}</strong>".</p>
        ${message ? `<p><strong>Response message:</strong> ${message}</p>` : ''}
        ${status === 'ACCEPTED' ? '<p>The counter offer rates have been accepted and will be included in the payment.</p>' : ''}
      `;
      await this.notifications.sendEmail(
        app.applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: `Counter offer ${status.toLowerCase()} successfully`,
      request: requests[requestIndex],
    };
  }

  /**
   * Service provider responds to employer's counter offer on their negotiation request
   */
  async respondToCounterOfferAsServiceProvider(
    applicantId: string,
    applicationId: string,
    requestId: string,
    counterOfferId: string,
    status: 'ACCEPTED' | 'REJECTED',
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        negotiationRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            currency: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You can only respond to counter offers for your own applications',
      );
    }

    const requests = (app.negotiationRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Negotiation request not found');
    }

    const request = requests[requestIndex];
    const suggestedByRole = request.suggestedByRole ?? 'JOB_SEEKER';
    if (suggestedByRole !== 'JOB_SEEKER') {
      throw new BadRequestException(
        'This negotiation request must be responded to by the service provider',
      );
    }

    if (!request.counterOffer || request.counterOffer.id !== counterOfferId) {
      throw new NotFoundException('Counter offer not found');
    }

    if (request.counterOffer.status !== 'PENDING') {
      throw new BadRequestException(
        'This counter offer has already been responded to',
      );
    }

    // Update counter offer status
    const updatedCounterOffer = {
      ...request.counterOffer,
      status,
      respondedAt: new Date().toISOString(),
      responseMessage: message || undefined,
    };

    // If accepted, update the negotiation request to use counter offer rates
    if (status === 'ACCEPTED') {
      requests[requestIndex] = {
        ...request,
        counterOffer: updatedCounterOffer,
        status: 'ACCEPTED',
        rates: request.counterOffer.rates, // Use counter offer rates
        totalAmount: request.counterOffer.totalAmount, // Use counter offer total
        respondedAt: new Date().toISOString(),
        responseMessage: message || undefined,
      };
    } else {
      // If rejected, just update counter offer status
      requests[requestIndex] = {
        ...request,
        counterOffer: updatedCounterOffer,
      };
    }

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        negotiationRequests: requests as any,
      },
    });

    // Post-acceptance: if counter offer is accepted, hard-lock verification code until paid.
    if (status === 'ACCEPTED' && app.status === 'ACCEPTED') {
      await this.ensurePendingVerificationCode(applicationId, 'HARD');
    }

    // Send notification to employer
    const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.job.employerId,
      type: 'APPLICATION_UPDATE',
      title:
        status === 'ACCEPTED'
          ? 'Counter Offer Accepted'
          : 'Counter Offer Rejected',
      body:
        status === 'ACCEPTED'
          ? `The service provider has accepted your counter offer for "${jobTitle}".`
          : `The service provider has rejected your counter offer for "${jobTitle}".`,
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId,
        counterOfferId,
        status,
      },
    });

    // Send email notification
    try {
      const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
      const emailSubject = `Counter Offer ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'} - ${jobTitle}`;
      const emailText = `Hello ${employerName},\n\nThe service provider has ${status.toLowerCase()} your counter offer for the job "${jobTitle}".\n${message ? `Response message: ${message}\n` : ''}${status === 'ACCEPTED' ? 'The counter offer rates have been accepted and will be included in the payment.\n' : ''}`;
      const emailHtml = `
        <h2>Counter Offer ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}</h2>
        <p>Hello ${employerName},</p>
        <p>The service provider has <strong>${status.toLowerCase()}</strong> your counter offer for the job "<strong>${jobTitle}</strong>".</p>
        ${message ? `<p><strong>Response message:</strong> ${message}</p>` : ''}
        ${status === 'ACCEPTED' ? '<p>The counter offer rates have been accepted and will be included in the payment.</p>' : ''}
      `;
      await this.notifications.sendEmail(
        app.job.employer.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: `Counter offer ${status.toLowerCase()} successfully`,
      counterOffer: updatedCounterOffer,
    };
  }

  /**
   * Service provider verifies the 4-digit code to start the service
   */
  async verifyServiceCode(
    serviceProviderId: string,
    applicationId: string,
    code: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    // Validate code format (4 digits)
    if (!/^\d{4}$/.test(code)) {
      throw new BadRequestException(
        'Verification code must be exactly 4 digits',
      );
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            employerId: true,
            status: true,
            title: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify service provider owns this application
    if (application.applicantId !== serviceProviderId) {
      throw new ForbiddenException(
        'You can only verify codes for your own applications',
      );
    }

    // Check if application is accepted
    if (application.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Application must be accepted before verifying the code',
      );
    }

    const currentVersion = (application as any).verificationCodeVersion || 1;
    const verifiedVersion =
      (application as any).verificationCodeVerifiedVersion || 0;

    // Check if the latest code version was already verified
    if (verifiedVersion >= currentVersion) {
      throw new BadRequestException('Service code has already been verified');
    }

    // Verify the code
    if (application.verificationCode !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    // Code is correct - mark as verified and update status
    const verifiedAt = new Date();
    const isFirstVerification = !application.verificationCodeVerifiedAt;
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        verificationCodeVerifiedAt: isFirstVerification
          ? verifiedAt
          : undefined,
        verificationCodeLastVerifiedAt: verifiedAt,
        verificationCodeVerifiedVersion: currentVersion,
      },
    });

    // Job status remains ASSIGNED - the booking status will change to IN_PROGRESS
    // This indicates the job is assigned and service has started

    // Update booking status only on the first verification (service start)
    if (isFirstVerification) {
      try {
        const booking = await this.prisma.booking.findFirst({
          where: {
            jobId: application.job.id,
            jobSeekerId: serviceProviderId,
          },
        });

        if (booking && booking.status === 'CONFIRMED') {
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: 'IN_PROGRESS',
              startTime: verifiedAt,
            },
          });
          console.log(
            `[Booking Status] Booking ${booking.id} set to IN_PROGRESS after code verification`,
          );
        }
      } catch (err) {
        console.error('[Booking Status] Failed to update booking status:', err);
      }
    }

    // Send notification to employer only on the first verification (service start)
    if (isFirstVerification) {
      try {
        const employerT = await this.emailTranslations.getTranslatorForUser(
          application.job.employerId,
        );
        const jobTitleForNotif =
          application.job.title || employerT('notifications.common.yourJob');
        await this.notifications.createNotification({
          userId: application.job.employerId,
          type: 'APPLICATION_UPDATE',
          title: employerT('notifications.templates.serviceStartedTitle'),
          body: employerT('notifications.templates.serviceStartedBody', {
            jobTitle: jobTitleForNotif,
          }),
          payload: {
            applicationId: application.id,
            jobId: application.job.id,
          },
        });
      } catch (err) {
        console.error(
          '[Notification] Failed to send service started notification:',
          err,
        );
      }
    }

    return {
      verified: true,
      verifiedAt: verifiedAt.toISOString(),
      message: 'Service code verified successfully. Service has started.',
    };
  }

  /**
   * Delete an instant job request (employer only, before acceptance)
   */
  async deleteInstantJobRequest(employerId: string, applicationId: string) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            employerId: true,
            isInstantBook: true,
            title: true,
          },
        },
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify job belongs to employer
    if (application.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only delete applications for your own jobs',
      );
    }

    // Verify it's an instant job request
    if (!application.job.isInstantBook) {
      throw new BadRequestException('This is not an instant job request');
    }

    // Verify application is not accepted
    if (application.status === 'ACCEPTED') {
      throw new BadRequestException(
        'Cannot delete instant job request after acceptance',
      );
    }

    // Delete the application
    await this.prisma.application.delete({
      where: { id: applicationId },
    });

    // Optionally delete the job if it has no other applications
    const otherApplications = await this.prisma.application.findFirst({
      where: {
        jobId: application.job.id,
        id: { not: applicationId },
        status: { not: 'WITHDRAWN' },
      },
    });

    if (!otherApplications) {
      // No other applications, delete the job
      await this.prisma.job.delete({
        where: { id: application.job.id },
      });
    }

    return {
      success: true,
      message: 'Instant job request deleted successfully',
    };
  }

  /**
   * Create an application for a candidate (for instant jobs)
   * This allows employers to create applications on behalf of candidates
   */
  async createApplicationForCandidate(
    employerId: string,
    jobId: string,
    candidateId: string,
  ) {
    if (!this.isValidObjectId(jobId)) {
      throw new BadRequestException('Invalid job id');
    }
    if (!this.isValidObjectId(candidateId)) {
      throw new BadRequestException('Invalid candidate id');
    }

    // Verify job exists and belongs to employer
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        employerId: true,
        title: true,
        status: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only create applications for your own jobs',
      );
    }

    if (job.status !== 'ACTIVE' && job.status !== 'ASSIGNED') {
      throw new BadRequestException(
        'Can only create applications for active jobs',
      );
    }

    // Verify candidate exists
    const candidate = await this.prisma.user.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.role !== 'JOB_SEEKER') {
      throw new BadRequestException('User is not a job seeker');
    }

    // Check if application already exists
    const existingApplication = await this.prisma.application.findFirst({
      where: {
        jobId: jobId,
        applicantId: candidateId,
        status: {
          not: 'WITHDRAWN',
        },
      },
    });

    if (existingApplication) {
      // Return existing application
      return this.getApplicationForUser(
        employerId,
        'EMPLOYER',
        existingApplication.id,
      );
    }

    // Create the application
    const application = await this.prisma.application.create({
      data: {
        job: { connect: { id: jobId } },
        applicant: { connect: { id: candidateId } },
        status: 'PENDING',
        coverLetter: 'Instant job request',
        appliedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        applicantId: true,
        jobId: true,
      },
    });

    // Send notification to candidate
    try {
      await this.notifications.createNotification({
        userId: candidateId,
        type: 'APPLICATION_UPDATE',
        title: (await this.emailTranslations.getTranslatorForUser(candidateId))(
          'notifications.templates.newJobOpportunityTitle',
        ),
        body: (await this.emailTranslations.getTranslatorForUser(candidateId))(
          'notifications.templates.newJobOpportunityBody',
          { jobTitle: job.title },
        ),
        payload: {
          applicationId: application.id,
          jobId: jobId,
        },
      });
    } catch (err) {
      console.error(
        '[Notification] Failed to send instant job notification:',
        err,
      );
    }

    // Return the application with full details
    return this.getApplicationForUser(employerId, 'EMPLOYER', application.id);
  }

  /**
   * Employer requests additional time from service provider
   */
  async requestAdditionalTime(
    employerId: string,
    applicationId: string,
    message: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        additionalTimeRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            startDate: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only request additional time for your own job applications',
      );
    }

    if (app.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Additional time can only be requested for accepted applications',
      );
    }

    const requests = (app.additionalTimeRequests as any) || [];
    const hasPendingRequest = requests.some(
      (req: any) => req.status === 'PENDING',
    );

    if (hasPendingRequest) {
      throw new BadRequestException(
        'You already have a pending additional time request',
      );
    }

    // Create new request
    const newRequest = {
      id: `time-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      requestedBy: 'EMPLOYER',
      message,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };

    requests.push(newRequest);

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        additionalTimeRequests: requests as any,
      },
    });

    // Send notification to service provider
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;

    await this.notifications.createNotification({
      userId: app.applicant.id,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )('notifications.templates.additionalTimeRequestedTitle'),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.applicant.id)
      )('notifications.templates.additionalTimeRequestedBody', { jobTitle }),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
        requestId: newRequest.id,
      },
    });

    // Send email notification
    try {
      const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
      const emailSubject = `Additional Time Requested - ${jobTitle}`;
      const emailText = `Hello ${applicantName},\n\nThe employer has requested additional time for the job "${jobTitle}".\n\nMessage: ${message}\n\nPlease review and respond with the number of additional days needed.`;
      const emailHtml = `
        <h2>Additional Time Requested</h2>
        <p>Hello ${applicantName},</p>
        <p>The employer has requested additional time for the job "<strong>${jobTitle}</strong>".</p>
        <p><strong>Message:</strong> ${message}</p>
        <p>Please review and respond with the number of additional days needed.</p>
      `;
      await this.notifications.sendEmail(
        app.applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: 'Additional time request sent successfully',
      request: newRequest,
    };
  }

  /**
   * Service provider responds to employer's additional time request
   */
  async respondToAdditionalTimeRequest(
    applicantId: string,
    applicationId: string,
    requestId: string,
    additionalDays: number,
    explanation: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    if (additionalDays <= 0 || !Number.isInteger(additionalDays)) {
      throw new BadRequestException(
        'Additional days must be a positive integer',
      );
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        additionalTimeRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            startDate: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You can only respond to additional time requests for your own applications',
      );
    }

    const requests = (app.additionalTimeRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Additional time request not found');
    }

    const request = requests[requestIndex];
    if (request.requestedBy !== 'EMPLOYER') {
      throw new BadRequestException(
        'This request must be responded to by the service provider',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This request has already been responded to',
      );
    }

    // Update request with service provider's response
    requests[requestIndex] = {
      ...request,
      status: 'PENDING_EMPLOYER_APPROVAL',
      additionalDays,
      explanation,
      respondedAt: new Date().toISOString(),
    };

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        additionalTimeRequests: requests as any,
      },
    });

    // Send notification to employer
    const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
    const jobTitle = app.job.title;

    {
      const employerT = await this.emailTranslations.getTranslatorForUser(
        app.job.employerId,
      );
      const daysLabel = `${additionalDays} ${employerT(
        additionalDays === 1
          ? 'notifications.common.daySingular'
          : 'notifications.common.dayPlural',
      )}`;

      await this.notifications.createNotification({
        userId: app.job.employerId,
        type: 'APPLICATION_UPDATE',
        title: employerT(
          'notifications.templates.additionalTimeResponseReceivedTitle',
        ),
        body: employerT(
          'notifications.templates.additionalTimeResponseReceivedBody',
          { jobTitle, days: daysLabel },
        ),
        payload: {
          applicationId: app.id,
          jobId: app.job.id,
          requestId,
          additionalDays,
        },
      });
    }

    // Send email notification
    try {
      const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
      const emailSubject = `Additional Time Response - ${jobTitle}`;
      const emailText = `Hello ${employerName},\n\nThe service provider has responded to your additional time request for the job "${jobTitle}".\n\nAdditional Days Requested: ${additionalDays}\nExplanation: ${explanation}\n\nPlease review and accept or reject this request.`;

      const content = `
        <p style="margin: 0 0 20px;">The service provider (<strong>${applicantName}</strong>) has responded to your additional time request for the job "<strong>${jobTitle}</strong>".</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #6366f1;">
          <p style="margin: 0 0 16px; color: #1f2937; font-weight: 600; font-size: 16px;">Additional Time Details:</p>
          <p style="margin: 0 0 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #1f2937;">Additional Days Requested:</strong> 
            <span style="color: #6366f1; font-weight: 700; font-size: 18px;">${additionalDays} day${additionalDays > 1 ? 's' : ''}</span>
          </p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px; color: #92400e; font-weight: 600; font-size: 14px;">Explanation from Service Provider:</p>
          <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6;">${explanation.replace(/\n/g, '<br>')}</p>
        </div>
        
        <p style="margin: 24px 0 0; color: #4b5563; font-size: 16px;">Please review and accept or reject this request.</p>
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        'Additional Time Response',
        `Hello ${employerName},`,
        content,
        'If accepted, the auto-completion deadline will be extended by the requested number of days.',
      );

      await this.notifications.sendEmail(
        app.job.employer.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: 'Response sent successfully',
      request: requests[requestIndex],
    };
  }

  /**
   * Employer accepts or rejects service provider's additional time response
   */
  async respondToAdditionalTimeResponse(
    employerId: string,
    applicationId: string,
    requestId: string,
    status: 'ACCEPTED' | 'REJECTED',
    message?: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        additionalTimeRequests: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            startDate: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only respond to additional time requests for your own job applications',
      );
    }

    const requests = (app.additionalTimeRequests as any) || [];
    const requestIndex = requests.findIndex((req: any) => req.id === requestId);

    if (requestIndex === -1) {
      throw new NotFoundException('Additional time request not found');
    }

    const request = requests[requestIndex];
    if (request.status !== 'PENDING_EMPLOYER_APPROVAL') {
      throw new BadRequestException(
        'This request is not awaiting your approval',
      );
    }

    // Update request status
    requests[requestIndex] = {
      ...request,
      status,
      employerResponseAt: new Date().toISOString(),
      employerResponseMessage: message || undefined,
    };

    // Note: We don't update the job startDate here because the timer is calculated
    // from verificationCodeVerifiedAt (when service started) + 4 days + additional days
    // The frontend will calculate the extended deadline based on accepted additional time requests

    // Update application
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        additionalTimeRequests: requests as any,
      },
    });

    // Send notification to service provider
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const jobTitle = app.job.title;

    {
      const applicantT = await this.emailTranslations.getTranslatorForUser(
        app.applicant.id,
      );
      const additionalDays = request.additionalDays;
      const daysLabel = `${additionalDays} ${applicantT(
        additionalDays === 1
          ? 'notifications.common.daySingular'
          : 'notifications.common.dayPlural',
      )}`;

      await this.notifications.createNotification({
        userId: app.applicant.id,
        type: 'APPLICATION_UPDATE',
        title: applicantT(
          status === 'ACCEPTED'
            ? 'notifications.templates.additionalTimeRequestAcceptedTitle'
            : 'notifications.templates.additionalTimeRequestRejectedTitle',
        ),
        body: applicantT(
          status === 'ACCEPTED'
            ? 'notifications.templates.additionalTimeRequestAcceptedBody'
            : 'notifications.templates.additionalTimeRequestRejectedBody',
          { jobTitle, days: daysLabel },
        ),
        payload: {
          applicationId: app.id,
          jobId: app.job.id,
          requestId,
          status,
        },
      });
    }

    // Send email notification
    try {
      const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
      const emailSubject = `Additional Time Request ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'} - ${jobTitle}`;
      const emailText = `Hello ${applicantName},\n\nThe employer has ${status.toLowerCase()} your request for ${request.additionalDays} additional day${request.additionalDays > 1 ? 's' : ''} for the job "${jobTitle}".\n${message ? `Response message: ${message}\n` : ''}`;

      const statusColor = status === 'ACCEPTED' ? '#10b981' : '#ef4444';
      const statusBg = status === 'ACCEPTED' ? '#d1fae5' : '#fee2e2';
      const statusText = status === 'ACCEPTED' ? '#065f46' : '#991b1b';

      const content = `
        <div style="background-color: ${statusBg}; padding: 20px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid ${statusColor};">
          <p style="margin: 0; color: ${statusText}; font-weight: 600; font-size: 16px;">
            <strong>${employerName}</strong> has <strong>${status.toLowerCase()}</strong> your request for ${request.additionalDays} additional day${request.additionalDays > 1 ? 's' : ''} for the job "<strong>${jobTitle}</strong>".
          </p>
        </div>
        ${
          message
            ? `
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid #6366f1;">
          <p style="margin: 0 0 8px; color: #1f2937; font-weight: 600; font-size: 14px;">Response Message:</p>
          <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        `
            : ''
        }
        ${
          status === 'ACCEPTED'
            ? `
        <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 24px 0 0; border-left: 4px solid #10b981;">
          <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
            <strong>Note:</strong> The auto-completion deadline has been extended by ${request.additionalDays} day${request.additionalDays > 1 ? 's' : ''}. You now have more time to complete the job.
          </p>
        </div>
        `
            : ''
        }
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        `Additional Time Request ${status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}`,
        `Hello ${applicantName},`,
        content,
        status === 'ACCEPTED'
          ? `Your request for ${request.additionalDays} additional day${request.additionalDays > 1 ? 's' : ''} has been accepted. The deadline has been extended accordingly.`
          : 'Your request for additional time has been rejected. Please contact the employer if you need to discuss this further.',
      );

      await this.notifications.sendEmail(
        app.applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: `Additional time request ${status.toLowerCase()} successfully`,
      request: requests[requestIndex],
    };
  }

  /**
   * Service provider marks the job as done
   */
  async markJobAsDoneByServiceProvider(
    applicantId: string,
    applicationId: string,
  ) {
    if (!this.isValidObjectId(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        serviceProviderMarkedDoneAt: true,
        completedAt: true,
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
            employer: {
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

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    if (app.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You can only mark jobs as done for your own applications',
      );
    }

    if (app.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'You can only mark accepted applications as done',
      );
    }

    if (app.completedAt) {
      throw new BadRequestException('This job has already been completed');
    }

    // Update application to mark as done by service provider
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        serviceProviderMarkedDoneAt: new Date(),
      },
    });

    // Send notification to employer
    const employerName = `${app.job.employer.firstName} ${app.job.employer.lastName}`;
    const jobTitle = app.job.title;
    const applicantName = `${app.applicant.firstName} ${app.applicant.lastName}`;

    await this.notifications.createNotification({
      userId: app.job.employerId,
      type: 'APPLICATION_UPDATE',
      title: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.jobMarkedAsDoneTitle'),
      body: (
        await this.emailTranslations.getTranslatorForUser(app.job.employerId)
      )('notifications.templates.jobMarkedAsDoneBody', { jobTitle }),
      payload: {
        applicationId: app.id,
        jobId: app.job.id,
      },
    });

    // Send email notification
    try {
      const t = await this.emailTranslations.getTranslatorForUser(
        app.job.employerId,
      );
      const emailSubject = t('email.jobs.jobMarkedAsDoneSubject', { jobTitle });
      const emailText = t('email.jobs.jobMarkedAsDoneText', {
        employerName,
        applicantName,
        jobTitle,
      });

      const content = `
        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid #10b981;">
          <p style="margin: 0; color: #065f46; font-weight: 600; font-size: 16px;">
            ${t('email.jobs.jobMarkedAsDoneMessage', { applicantName, jobTitle })}
          </p>
        </div>
        
        <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${t('email.jobs.jobMarkedAsDoneReviewMessage')}
        </p>
        
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #6366f1;">
          <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
            <strong style="color: #1f2937;">${t('email.jobs.nextSteps')}:</strong> ${t('email.jobs.jobMarkedAsDoneNextSteps')}
          </p>
        </div>
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        t('email.jobs.jobMarkedAsDoneTitle'),
        t('email.jobs.jobMarkedAsDoneGreeting', { employerName }),
        content,
        t('email.jobs.jobMarkedAsDoneFooter'),
      );

      await this.notifications.sendEmail(
        app.job.employer.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return {
      success: true,
      message: 'Job marked as done successfully',
      markedDoneAt: new Date().toISOString(),
    };
  }
}
