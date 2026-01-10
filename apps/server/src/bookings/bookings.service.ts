import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, PaymentType } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';
import { CreateDirectBookingDto } from './dto/create-direct-booking.dto';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
    private readonly emailTranslations: EmailTranslationsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
  ) {}

  private async hasSeekerBookingConflict(
    jobSeekerId: string,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    // Look for overlapping bookings for the seeker that are not cancelled/completed
    const existing = await this.prisma.booking.findFirst({
      where: {
        jobSeekerId,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.IN_PROGRESS,
          ],
        },
        NOT: [{ endTime: { lte: start } }, { startTime: { gte: end } }],
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async createDirectBooking(employerId: string, dto: CreateDirectBookingDto) {
    // Check employer restrictions
    const employer = await this.prisma.user.findUnique({
      where: { id: employerId },
      select: { isActive: true, idVerificationData: true },
    });
    if (!employer) throw new NotFoundException('Employer not found');
    if (!employer.isActive) {
      const data = employer.idVerificationData as any;
      if (data?.banned) {
        throw new BadRequestException(
          `Your account has been banned. Reason: ${data.banReason || 'Account banned'}. You cannot create bookings.`,
        );
      }
      if (data?.suspended) {
        throw new BadRequestException(
          `Your account has been suspended. Reason: ${data.suspendReason || 'Account suspended'}. You cannot create bookings.`,
        );
      }
      throw new BadRequestException(
        'Account must be active to create bookings',
      );
    }
    const employerData = employer.idVerificationData as any;
    if (employerData?.restricted) {
      const restrictions = employerData.restrictions || {};
      if (restrictions.canBookJobs === false) {
        throw new BadRequestException(
          `Your account access has been restricted. Reason: ${employerData.restrictionReason || 'Account restricted'}. You cannot create bookings.`,
        );
      }
    }

    const seeker = await this.prisma.user.findUnique({
      where: { id: dto.jobSeekerId },
      select: {
        id: true,
        connectedAccountId: true,
        isActive: true,
        idVerificationData: true,
      },
    });
    if (!seeker) throw new NotFoundException('Job seeker not found');

    // Check job seeker restrictions
    if (!seeker.isActive) {
      const data = seeker.idVerificationData as any;
      if (data?.banned) {
        throw new BadRequestException(
          `The job seeker's account has been banned. Reason: ${data.banReason || 'Account banned'}.`,
        );
      }
      if (data?.suspended) {
        throw new BadRequestException(
          `The job seeker's account has been suspended. Reason: ${data.suspendReason || 'Account suspended'}.`,
        );
      }
      throw new BadRequestException('Job seeker account must be active');
    }
    const seekerData = seeker.idVerificationData as any;
    if (seekerData?.restricted) {
      const restrictions = seekerData.restrictions || {};
      if (restrictions.canBookJobs === false) {
        throw new BadRequestException(
          `The job seeker's account access has been restricted. Reason: ${seekerData.restrictionReason || 'Account restricted'}.`,
        );
      }
    }

    // Require connected account so we can authorize payment holds later
    if (!seeker.connectedAccountId) {
      throw new BadRequestException('Job seeker is not payments-enabled yet');
    }

    const start = new Date(dto.start);
    const end = new Date(dto.end);
    if (!(start instanceof Date) || isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start');
    }
    if (!(end instanceof Date) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid end');
    }
    if (end <= start) {
      throw new BadRequestException('End must be after start');
    }

    // Ensure the requested window is within an availability slot
    const hasCoverage = await this.availability.hasAvailabilityCoverage(
      dto.jobSeekerId,
      start,
      end,
    );
    if (!hasCoverage) {
      throw new BadRequestException(
        'Requested time is not within seeker availability',
      );
    }

    // Prevent double-booking for this seeker
    const hasConflict = await this.hasSeekerBookingConflict(
      dto.jobSeekerId,
      start,
      end,
    );
    if (hasConflict) {
      throw new BadRequestException(
        'Seeker already has a booking overlapping this time window',
      );
    }

    const data = {
      jobSeekerId: dto.jobSeekerId,
      employerId,
      startTime: start,
      endTime: end,
      status: BookingStatus.CONFIRMED,
      agreedPayUnit: dto.payUnit as PaymentType,
      agreedRateAmount: dto.rateAmount,
      agreedCurrency: dto.currency,
      title: dto.title ?? null,
      notes: dto.notes ?? null,
    };
    const booking = await this.prisma.booking.create({
      data: data,
    });

    return { id: booking.id };
  }

  async listForSeeker(
    userId: string,
    options?: { status?: BookingStatus; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    console.log(
      `[BookingsService] listForSeeker called with userId=${userId}, status=${options?.status || 'undefined'}, page=${page}, pageSize=${pageSize}`,
    );

    // Auto-sync bookings when fetching (only if no status filter, meaning we're fetching all bookings)
    // This ensures bookings are synced when user views receipts
    if (!options?.status) {
      try {
        // Run sync in background (don't wait for it)
        this.payments
          .syncBookingsForServiceProvider(userId)
          .catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : 'Unknown error';
            console.error(
              `[BookingsService] Background sync failed: ${message}`,
            );
          });
      } catch (err: unknown) {
        // Silently fail - sync is best effort
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.log(
          `[BookingsService] Could not auto-sync bookings: ${message}`,
        );
      }
    }

    // Note: We filter out deleted jobs in post-processing since Prisma doesn't support not:null in nested relations
    const rows = await this.prisma.booking.findMany({
      where: {
        jobSeekerId: userId,
        ...(options?.status ? { status: options.status } : {}),
      },
      include: {
        job: {
          select: {
            id: true,
            employerId: true,
            title: true,
            location: true,
            city: true,
            country: true,
            coordinates: true,
          },
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            location: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: [{ startTime: 'asc' }, { updatedAt: 'desc' }],
      skip,
      take: pageSize,
    });

    // For each booking with a jobId, find the corresponding application
    const bookingsWithApplications = await Promise.all(
      rows.map(async (booking) => {
        let applicationId: string | null = null;
        if (booking.jobId && booking.jobSeekerId) {
          // Find the application for this job and job seeker
          const application = await this.prisma.application.findUnique({
            where: {
              applicantId_jobId: {
                applicantId: booking.jobSeekerId,
                jobId: booking.jobId,
              },
            },
            select: {
              id: true,
            },
          });
          applicationId = application?.id || null;
        }
        return {
          ...booking,
          applicationId,
        };
      }),
    );

    // Filter out any bookings where job is null (deleted jobs)
    const validBookings = bookingsWithApplications.filter((booking) => {
      // If booking has a jobId, the job must exist and not be null
      if (booking.jobId) {
        if (!booking.job || !booking.job.id) {
          console.log(
            `[BookingsService] Filtering out booking ${booking.id} - job was deleted (jobId: ${booking.jobId}, job: ${booking.job ? 'exists' : 'null'})`,
          );
          return false;
        }
        return true;
      }
      // Direct bookings (no jobId) are always valid
      return true;
    });

    console.log(
      `[BookingsService] Found ${rows.length} bookings for seeker ${userId}, ${validBookings.length} valid (after filtering deleted jobs)`,
    );
    if (validBookings.length > 0) {
      console.log(
        `[BookingsService] Valid booking IDs:`,
        validBookings.map((r) => r.id),
      );
    }
    if (rows.length > validBookings.length) {
      const filteredIds = rows
        .filter((b) => {
          if (b.jobId && (!b.job || !b.job.id)) return true;
          return false;
        })
        .map((b) => b.id);
      console.log(
        `[BookingsService] Filtered out ${rows.length - validBookings.length} bookings with deleted jobs:`,
        filteredIds,
      );
    }

    return validBookings;
  }

  async listForEmployer(
    userId: string,
    options?: { status?: BookingStatus; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    console.log(
      `[BookingsService] listForEmployer called with userId=${userId}, status=${options?.status}, page=${page}, pageSize=${pageSize}`,
    );

    // Include both direct and job-based employer bookings
    // Note: We'll filter out deleted jobs in post-processing since Prisma doesn't support not:null in nested relations
    const rows = await this.prisma.booking.findMany({
      where: {
        OR: [{ employerId: userId }, { job: { employerId: userId } }],
        ...(options?.status ? { status: options.status } : {}),
      },
      include: {
        job: {
          select: {
            id: true,
            employerId: true,
            title: true,
            location: true,
            city: true,
            country: true,
            coordinates: true,
          },
        },
        jobSeeker: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        employer: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
    });

    // Filter out any bookings where job is null (deleted jobs)
    const validBookings = rows.filter((booking) => {
      // If booking has a jobId, the job must exist and not be null
      if (booking.jobId) {
        if (!booking.job || !booking.job.id) {
          console.log(
            `[BookingsService] Filtering out booking ${booking.id} - job was deleted (jobId: ${booking.jobId}, job: ${booking.job ? 'exists' : 'null'})`,
          );
          return false;
        }
        return true;
      }
      // Direct bookings (no jobId) - check if they're orphaned from deleted jobs
      // Note: We'll check this after the filter since we need async operations
      // For now, keep direct bookings - we'll filter them separately
      return true;
    });

    // Now filter out orphaned direct bookings (those with jobId: null that are related to deleted jobs)
    const directBookings = validBookings.filter((b) => !b.jobId);
    const orphanedBookingIds = new Set<string>();

    if (directBookings.length > 0) {
      // Check each direct booking to see if it's orphaned
      for (const booking of directBookings) {
        if (booking.employerId && booking.jobSeekerId) {
          // Check if there are any accepted applications with deleted jobs
          const applications = await this.prisma.application.findMany({
            where: {
              applicantId: booking.jobSeekerId,
              status: 'ACCEPTED',
            },
            select: {
              id: true,
              jobId: true,
              job: {
                select: {
                  id: true,
                },
              },
            },
          });

          // Check if any application has a jobId but the job doesn't exist (was deleted)
          const orphanedApplication = applications.find(
            (app) => app.jobId && !app.job,
          );

          // Simple check: if booking has a title, verify there's an active job with that title
          // If no active job exists with this title for this employer, the booking is orphaned
          let isOrphanedByTitle = false;
          if (booking.title && booking.employerId) {
            const activeJobWithTitle = await this.prisma.job.findFirst({
              where: {
                title: booking.title,
                employerId: booking.employerId,
                status: 'ACTIVE',
              },
              select: { id: true },
            });
            // If no active job exists with this title, and we have accepted applications, check if they're for deleted jobs
            if (!activeJobWithTitle && applications.length > 0) {
              // If ALL applications are for deleted jobs (have jobId but job is null), this booking is orphaned
              const allAppsHaveDeletedJobs = applications.every(
                (app) => app.jobId && !app.job,
              );
              if (allAppsHaveDeletedJobs) {
                isOrphanedByTitle = true;
              }
            } else if (!activeJobWithTitle && !applications.length) {
              // No active job with this title AND no accepted applications - likely orphaned
              isOrphanedByTitle = true;
            }
          }

          if (orphanedApplication || isOrphanedByTitle) {
            // This booking is orphaned - delete it immediately
            try {
              await this.prisma.booking.delete({
                where: { id: booking.id },
              });
              orphanedBookingIds.add(booking.id);
            } catch (error) {
              // Log error but continue
              console.error(
                `[BookingsService] Failed to delete orphaned booking ${booking.id}:`,
                error,
              );
            }
          }
        }
      }
    }

    // Filter out orphaned bookings
    const finalValidBookings = validBookings.filter(
      (b) => !orphanedBookingIds.has(b.id),
    );

    console.log(
      `[BookingsService] Found ${rows.length} bookings for employer ${userId}, ${finalValidBookings.length} valid (after filtering deleted jobs and orphaned bookings)`,
    );
    if (finalValidBookings.length > 0) {
      console.log(
        `[BookingsService] Valid booking IDs:`,
        finalValidBookings.map((r) => r.id),
      );
    }
    if (rows.length > finalValidBookings.length) {
      const filteredIds = rows
        .filter((b) => {
          if (b.jobId && (!b.job || !b.job.id)) return true;
          return false;
        })
        .map((b) => b.id);
      console.log(
        `[BookingsService] Filtered out ${rows.length - finalValidBookings.length} bookings with deleted jobs:`,
        filteredIds,
      );
    }

    return finalValidBookings;
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        jobSeeker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            coordinates: true,
          },
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            coordinates: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            coordinates: true,
            employer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                coordinates: true,
              },
            },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // If booking has a jobId but job is null, the job was deleted - throw error
    if (booking.jobId && (!booking.job || !booking.job.id)) {
      throw new NotFoundException(
        'Booking is no longer available. The associated job has been removed.',
      );
    }

    return booking;
  }

  async updateBookingStatus(
    bookingId: string,
    userId: string,
    newStatus: BookingStatus,
    userRole: 'EMPLOYER' | 'JOB_SEEKER',
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        jobSeekerId: true,
        employerId: true,
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
          },
        },
        jobSeeker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    // Verify user has permission
    if (userRole === 'JOB_SEEKER') {
      if (booking.jobSeekerId !== userId) {
        throw new BadRequestException('You can only update your own bookings');
      }
    } else if (userRole === 'EMPLOYER') {
      const isEmployer =
        booking.employerId === userId || booking.job?.employerId === userId;
      if (!isEmployer) {
        throw new BadRequestException(
          'You can only update bookings for your jobs',
        );
      }
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: newStatus },
      include: {
        job: { select: { id: true, title: true, employerId: true } },
        jobSeeker: { select: { id: true, firstName: true, lastName: true } },
        employer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Send push notification when service provider starts tracking
    if (
      newStatus === BookingStatus.IN_PROGRESS &&
      userRole === 'JOB_SEEKER' &&
      booking.employerId
    ) {
      const providerName = booking.jobSeeker
        ? `${booking.jobSeeker.firstName} ${booking.jobSeeker.lastName}`.trim()
        : 'Service Provider';

      const t = await this.emailTranslations.getTranslatorForUser(
        booking.employerId,
      );
      const jobTitleLabel =
        booking.job?.title || t('notifications.common.yourJob');

      // Send push notification to employer
      await this.notifications.createNotification({
        userId: booking.employerId,
        type: 'APPLICATION_UPDATE',
        title: t('notifications.templates.trackingStartedTitle'),
        body: t('notifications.templates.trackingStartedBody', {
          providerName,
          jobTitle: jobTitleLabel,
        }),
        payload: {
          bookingId: booking.id,
          status: 'IN_PROGRESS',
          type: 'TRACKING_STARTED',
        },
      });

      // Also send push notification
      await this.notifications.sendPushNotification(
        booking.employerId,
        t('notifications.templates.trackingStartedTitle'),
        t('notifications.templates.trackingStartedBody', {
          providerName,
          jobTitle: jobTitleLabel,
        }),
        {
          type: 'TRACKING_STARTED',
          bookingId: booking.id,
          status: 'IN_PROGRESS',
        },
      );
    }

    // Send push notification when service provider stops tracking
    if (
      newStatus === BookingStatus.CONFIRMED &&
      userRole === 'JOB_SEEKER' &&
      booking.status === BookingStatus.IN_PROGRESS &&
      booking.employerId
    ) {
      const providerName = booking.jobSeeker
        ? `${booking.jobSeeker.firstName} ${booking.jobSeeker.lastName}`.trim()
        : 'Service Provider';

      const t = await this.emailTranslations.getTranslatorForUser(
        booking.employerId,
      );
      const jobTitleLabel =
        booking.job?.title || t('notifications.common.yourJob');

      // Send push notification to employer
      await this.notifications.createNotification({
        userId: booking.employerId,
        type: 'APPLICATION_UPDATE',
        title: t('notifications.templates.trackingStoppedTitle'),
        body: t('notifications.templates.trackingStoppedBody', {
          providerName,
          jobTitle: jobTitleLabel,
        }),
        payload: {
          bookingId: booking.id,
          status: 'CONFIRMED',
          type: 'TRACKING_STOPPED',
        },
      });

      // Also send push notification
      await this.notifications.sendPushNotification(
        booking.employerId,
        t('notifications.templates.trackingStoppedTitle'),
        t('notifications.templates.trackingStoppedBody', {
          providerName,
          jobTitle: jobTitleLabel,
        }),
        {
          type: 'TRACKING_STOPPED',
          bookingId: booking.id,
          status: 'CONFIRMED',
        },
      );
    }

    return updated;
  }

  async deleteBooking(
    bookingId: string,
    userId: string,
    userRole: 'EMPLOYER' | 'JOB_SEEKER',
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        employerId: true,
        jobSeekerId: true,
        job: {
          select: {
            id: true,
            employerId: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify user has permission to delete
    if (userRole === 'EMPLOYER') {
      const isEmployer =
        booking.employerId === userId || booking.job?.employerId === userId;
      if (!isEmployer) {
        throw new BadRequestException(
          'You can only delete bookings for your jobs',
        );
      }
    } else if (userRole === 'JOB_SEEKER') {
      if (booking.jobSeekerId !== userId) {
        throw new BadRequestException('You can only delete your own bookings');
      }
    }

    // Delete the booking
    await this.prisma.booking.delete({
      where: { id: bookingId },
    });

    return { success: true, message: 'Booking deleted successfully' };
  }

  // Debug method to list all bookings for a user (for debugging)
  async debugListAll(userId: string) {
    console.log(`[Debug] Listing all bookings for userId: ${userId}`);

    // Get all bookings where user is employer
    const asEmployer = await this.prisma.booking.findMany({
      where: {
        OR: [{ employerId: userId }, { job: { employerId: userId } }],
      },
      include: {
        job: { select: { id: true, employerId: true, title: true } },
        jobSeeker: { select: { id: true, firstName: true, lastName: true } },
        employer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Get all bookings where user is job seeker
    const asSeeker = await this.prisma.booking.findMany({
      where: { jobSeekerId: userId },
      include: {
        job: { select: { id: true, employerId: true, title: true } },
        jobSeeker: { select: { id: true, firstName: true, lastName: true } },
        employer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    console.log(
      `[Debug] Found ${asEmployer.length} bookings as employer, ${asSeeker.length} as seeker`,
    );

    // Combine and deduplicate
    const all = [...asEmployer, ...asSeeker];
    const unique = all.filter(
      (booking, index, self) =>
        index === self.findIndex((b) => b.id === booking.id),
    );

    return unique.map((b) => ({
      id: b.id,
      status: b.status,
      employerId: b.employerId,
      jobSeekerId: b.jobSeekerId,
      jobId: b.jobId,
      jobEmployerId: b.job?.employerId,
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
    }));
  }
}
