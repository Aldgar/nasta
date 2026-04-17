import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';
import { ChatService } from '../chat/chat.service';
import type {
  Prisma,
  JobType as PJobType,
  WorkMode as PWorkMode,
} from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private emailTranslations: EmailTranslationsService,
    private chatService: ChatService,
  ) {}

  async listJobs(params?: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
    category?: string;
    skill?: string;
  }) {
    const baseSelect = {
      id: true,
      title: true,
      description: true,
      type: true,
      workMode: true,
      location: true,
      city: true,
      country: true,
      isInstantBook: true,
      createdAt: true,
      coordinates: true,
      urgency: true,
      status: true,
      employerId: true,
      // Payment information
      salaryMin: true,
      salaryMax: true,
      paymentType: true,
      rateAmount: true,
      currency: true,
      company: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      employer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          country: true,
          avatar: true,
          isVerified: true,
          company: { select: { name: true } },
        },
      },
      _count: { select: { applications: true } },
    } as const;

    // Build where clause for filtering
    // Only show ACTIVE jobs (jobs with accepted applications should have status CLOSED)
    // Exclude instant jobs – they are targeted at specific service providers
    const whereClause: Prisma.JobWhereInput = {
      status: 'ACTIVE',
      isInstantBook: { not: true },
    };

    // Filter by category name if provided
    if (params?.category) {
      whereClause.category = { name: params.category };
    }

    // Filter by skill name if provided (through job skills)
    if (params?.skill) {
      whereClause.skills = {
        some: {
          skill: {
            name: params.skill,
          },
        },
      };
    }

    // If no geo params, return latest active (urgent jobs first)
    if (typeof params?.lat !== 'number' || typeof params?.lng !== 'number') {
      const jobs = await this.prisma.job.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: baseSelect,
      });
      // Sort by urgency: URGENT > HIGH > NORMAL > LOW
      const urgencyOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
      return jobs
        .sort((a, b) => {
          const urgencyA =
            urgencyOrder[
              (a.urgency as keyof typeof urgencyOrder) || 'NORMAL'
            ] || 2;
          const urgencyB =
            urgencyOrder[
              (b.urgency as keyof typeof urgencyOrder) || 'NORMAL'
            ] || 2;
          if (urgencyA !== urgencyB) {
            return urgencyB - urgencyA;
          }
          return 0;
        })
        .map((j) => ({
          ...j,
          applicantCount: (j as any)._count?.applications ?? 0,
        }));
    }

    const radiusKm =
      params.radiusKm && params.radiusKm > 0 ? params.radiusKm : 10;
    const limit =
      params.limit && params.limit > 0 ? Math.min(params.limit, 200) : 100;
    // Fetch a reasonable batch then filter by distance (urgent jobs first)
    const jobs = await this.prisma.job.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: baseSelect,
    });
    const withCoords = jobs.filter(
      (j) => Array.isArray(j.coordinates) && j.coordinates.length === 2,
    );
    const lat = params.lat;
    const lng = params.lng;
    const enriched = withCoords
      .map((j) => ({
        job: j,
        distanceKm: haversineKm(
          lat,
          lng,
          (j.coordinates as [number, number])[0],
          (j.coordinates as [number, number])[1],
        ),
      }))
      .filter((x) => x.distanceKm <= radiusKm)
      .sort((a, b) => {
        // First sort by urgency (URGENT > HIGH > NORMAL > LOW)
        const urgencyOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
        const urgencyA =
          urgencyOrder[
            (a.job.urgency as keyof typeof urgencyOrder) || 'NORMAL'
          ] || 2;
        const urgencyB =
          urgencyOrder[
            (b.job.urgency as keyof typeof urgencyOrder) || 'NORMAL'
          ] || 2;
        if (urgencyA !== urgencyB) {
          return urgencyB - urgencyA; // Higher urgency first
        }
        // Then by distance
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, limit)
      .map((x) => ({
        ...x.job,
        distanceKm: x.distanceKm,
        applicantCount: (x.job as any)._count?.applications ?? 0,
      }));
    return enriched;
  }

  async getJob(id: string, userId?: string, userRole?: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        requirements: true,
        responsibilities: true,
        type: true,
        workMode: true,
        location: true,
        city: true,
        country: true,
        isInstantBook: true,
        createdAt: true,
        status: true,
        urgency: true,
        employerId: true,
        startDate: true,
        salaryMin: true,
        salaryMax: true,
        paymentType: true,
        rateAmount: true,
        currency: true,
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            country: true,
            avatar: true,
            isVerified: true,
            company: { select: { name: true } },
          },
        },
        _count: { select: { applications: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');

    let myApplication: { id: string; status: string; appliedAt: Date } | null =
      null;
    if (userId) {
      myApplication = await this.prisma.application.findUnique({
        where: { applicantId_jobId: { applicantId: userId, jobId: id } },
        select: { id: true, status: true, appliedAt: true },
      });
    }

    // Fix status if job has accepted applications but status is still ACTIVE
    // Only update if not already updated (to avoid race conditions)
    if (job.status === 'ACTIVE') {
      const acceptedApplication = await this.prisma.application.findFirst({
        where: {
          jobId: id,
          status: 'ACCEPTED',
        },
        select: { id: true, completedAt: true },
      });

      if (acceptedApplication) {
        // Re-fetch job to ensure we have the latest status (might have been updated by another request)
        const updatedJob = await this.prisma.job.findUnique({
          where: { id },
          select: { status: true },
        });

        if (updatedJob && updatedJob.status === 'ACTIVE') {
          // Check if job is completed
          if (acceptedApplication.completedAt) {
            // Update job status to COMPLETED
            await this.prisma.job.update({
              where: { id },
              data: { status: 'COMPLETED' },
            });
            // Lock chat conversations for this job
            await this.chatService.lockConversationsByJobId(id);
            job.status = 'COMPLETED';
          } else {
            // Update job status to ASSIGNED
            await this.prisma.job.update({
              where: { id },
              data: { status: 'ASSIGNED' },
            });
            job.status = 'ASSIGNED';
          }
        } else if (updatedJob) {
          // Status was already updated, use the updated status
          job.status = updatedJob.status;
        }
      }
    }

    // If user is the employer, allow them to view their own jobs regardless of status
    const isEmployer = userRole === 'EMPLOYER' || userRole === 'ADMIN';
    const isJobOwner = userId && job.employerId === userId;

    const enriched = {
      ...job,
      applicantCount: (job as any)._count?.applications ?? 0,
      myApplication: myApplication ?? undefined,
    };

    if (isEmployer && isJobOwner) {
      return enriched;
    }

    if (job.status !== 'ACTIVE') {
      throw new NotFoundException('Job not found or not available');
    }
    return enriched;
  }

  async applyToJob(
    jobId: string,
    userId: string,
    coverLetter?: string,
    cvUrl?: string,
  ) {
    // Check user restrictions before allowing application
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        idVerificationData: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for account restrictions
    if (!user.isActive) {
      const data = user.idVerificationData as any;
      if (data?.banned) {
        throw new ForbiddenException(
          `Your account has been banned. Reason: ${data.banReason || 'Account banned'}. You cannot apply to jobs. Please contact support.`,
        );
      }
      if (data?.suspended) {
        throw new ForbiddenException(
          `Your account has been suspended. Reason: ${data.suspendReason || 'Account suspended'}. You cannot apply to jobs. Please contact support.`,
        );
      }
      throw new ForbiddenException('Account must be active to apply to jobs');
    }

    // Check for restrictions (account is active but restricted)
    const data = user.idVerificationData as any;
    if (data?.restricted) {
      const restrictions = data.restrictions || {};
      if (restrictions.canApplyToJobs === false) {
        throw new ForbiddenException(
          `Your account access has been restricted. Reason: ${data.restrictionReason || 'Account restricted'}. You cannot apply to jobs. Please contact support.`,
        );
      }
    }

    // Ensure job exists and active
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        employerId: true,
        title: true,
        location: true,
        city: true,
        employer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!job || job.status !== 'ACTIVE') {
      throw new NotFoundException('Job not found or not open');
    }
    // Create application; unique(applicantId, jobId) enforces no duplicate
    try {
      const app = await this.prisma.application.create({
        data: {
          jobId,
          applicantId: userId,
          coverLetter: coverLetter || null,
          cvUrl: cvUrl || null,
          status: 'PENDING',
        },
        select: { id: true, status: true, appliedAt: true },
      });

      // Get applicant details for notifications
      const applicant = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, email: true },
      });

      // Notify applicant (service provider) about successful application
      if (applicant) {
        // In-app notification
        void (async () => {
          const t = await this.emailTranslations.getTranslatorForUser(userId);
          await this.notifications.createNotification({
            userId,
            type: 'APPLICATION_UPDATE',
            title: t('notifications.templates.applicationSubmittedTitle'),
            body: t('notifications.templates.applicationSubmittedBody', {
              jobTitle: job.title,
            }),
            payload: {
              jobId: job.id,
              applicationId: app.id,
              status: 'PENDING',
            },
          });
        })();

        // Email notification with branded template
        const employerName = job.employer
          ? `${job.employer.firstName || ''} ${job.employer.lastName || ''}`.trim() ||
            'the employer'
          : 'the employer';
        void this.notifications.sendJobApplicationConfirmationEmail(
          userId,
          job.id,
          job.title,
          job.location || job.city || 'Location not specified',
          employerName,
        );
      }

      // Notify employer about new application (best-effort)
      if (job.employerId) {
        void (async () => {
          const t = await this.emailTranslations.getTranslatorForUser(
            job.employerId,
          );
          await this.notifications.createNotification({
            userId: job.employerId,
            type: 'APPLICATION_UPDATE',
            title: t('notifications.templates.newApplicationReceivedTitle'),
            body: t('notifications.templates.newApplicationReceivedBody', {
              jobTitle: job.title,
            }),
            payload: { jobId: job.id, applicationId: app.id },
          });
        })();
      }
      return { application: app, message: 'Application submitted' };
    } catch {
      throw new ConflictException('You already applied to this job');
    }
  }

  async createJob(
    employerId: string,
    dto: {
      title: string;
      description: string;
      requirements?: string[];
      responsibilities?: string[];
      type?:
        | 'FULL_TIME'
        | 'PART_TIME'
        | 'CONTRACT'
        | 'TEMPORARY'
        | 'INTERNSHIP'
        | 'FREELANCE'
        | 'GIG';
      workMode?: 'ON_SITE' | 'REMOTE' | 'HYBRID';
      isInstantBook?: boolean;
      urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      duration?: string;
      showContactInfo?: boolean;
      categoryId?: string;
      categoryName?: string;
      location: string;
      city: string;
      country: string;
      lat: number;
      lng: number;
      startDate?: string;
      endDate?: string;
      rateAmount?: number;
      currency?: string;
      paymentType?: string;
      requiresVehicle?: boolean;
      requiresDriverLicense?: boolean;
    },
  ) {
    // Ensure employer is EMPLOYER role, email verified, and has address
    const employer = await this.prisma.user.findUnique({
      where: { id: employerId },
      select: {
        role: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        isActive: true,
        idVerificationData: true,
      },
    });

    // Get employer profile to check address
    const employerProfile = await this.prisma.employerProfile.findUnique({
      where: { employerId: employerId },
      select: {
        addressLine1: true,
        city: true,
        country: true,
        postalCode: true,
      },
    });

    if (!employer) {
      throw new ForbiddenException('Employer not found');
    }

    // Check for account restrictions
    if (!employer.isActive) {
      const verificationData = employer.idVerificationData as any;
      if (verificationData?.banned) {
        throw new ForbiddenException(
          `Your account has been banned. Reason: ${verificationData.banReason || 'Account banned'}. Please contact support.`,
        );
      }
      if (verificationData?.suspended) {
        throw new ForbiddenException(
          `Your account has been suspended. Reason: ${verificationData.suspendReason || 'Account suspended'}. Please contact support.`,
        );
      }
      throw new ForbiddenException('Account must be active to post jobs');
    }

    // Check for restrictions (account is active but restricted)
    const restrictionData = employer.idVerificationData as any;
    if (restrictionData?.restricted) {
      const restrictions = restrictionData.restrictions || {};
      if (restrictions.canPostJobs === false) {
        throw new ForbiddenException(
          `Your account access has been restricted. Reason: ${restrictionData.restrictionReason || 'Account restricted'}. You cannot post jobs. Please contact support.`,
        );
      }
    }
    if (employer.role === 'ADMIN') {
      // Admins can post without verification to test flows
    } else if (employer.role === 'EMPLOYER') {
      // Check email verification
      if (!employer.emailVerifiedAt) {
        throw new UnprocessableEntityException({
          code: 'ERR_EMAIL_VERIFICATION_REQUIRED',
          message:
            'Email verification required to post jobs. Please verify your email in Settings.',
          action: { method: 'POST', endpoint: '/auth/email/request-verify' },
        });
      }
      // Check address verification (must have addressLine1 or city and country)
      const hasAddress =
        employerProfile &&
        (employerProfile.addressLine1 ||
          (employerProfile.city && employerProfile.country));
      if (!hasAddress) {
        throw new UnprocessableEntityException({
          code: 'ERR_ADDRESS_REQUIRED',
          message:
            'Address verification required to post jobs. Please add your address in Settings.',
          action: { method: 'PATCH', endpoint: '/profiles/employer/me' },
        });
      }
    } else {
      throw new ForbiddenException('Only employers or admins can post jobs');
    }

    // Resolve category: accept either existing categoryId, or categoryName to create/find one dynamically.
    let resolvedCategoryId: string | undefined = dto.categoryId;
    if (!resolvedCategoryId) {
      const name = (dto.categoryName ?? '').trim();
      if (!name) {
        throw new UnprocessableEntityException({
          code: 'ERR_CATEGORY_REQUIRED',
          message: 'Provide either categoryId or categoryName',
        });
      }
      // Drivers category should enforce driver license; others are free-form
      const driverRegex = /^(driver|drivers|driving)$/i;
      const requiresDriverLicense = driverRegex.test(name);
      // Try to find by exact name first
      let cat = await this.prisma.jobCategory.findFirst({
        where: { name },
        select: { id: true },
      });
      if (!cat) {
        cat = await this.prisma.jobCategory.create({
          data: { name, requiresDriverLicense, isActive: true },
          select: { id: true },
        });
      }
      resolvedCategoryId = cat.id;
    } else {
      // Validate existing categoryId
      const cat = await this.prisma.jobCategory.findUnique({
        where: { id: resolvedCategoryId },
        select: { id: true },
      });
      if (!cat) {
        throw new UnprocessableEntityException({
          code: 'ERR_INVALID_CATEGORY',
          message: 'Provided categoryId is invalid',
        });
      }
    }

    // Narrow type for TS/linter
    if (!resolvedCategoryId) {
      throw new UnprocessableEntityException({
        code: 'ERR_CATEGORY_RESOLUTION',
        message: 'Category could not be resolved',
      });
    }

    const data: Prisma.JobCreateInput = {
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements ?? [],
      responsibilities: dto.responsibilities ?? [],
      type: (dto.type as unknown as PJobType) ?? ('FULL_TIME' as PJobType),
      workMode:
        (dto.workMode as unknown as PWorkMode) ?? ('ON_SITE' as PWorkMode),
      urgency: (dto.urgency as unknown as any) ?? ('NORMAL' as any),
      duration: dto.duration ?? null,
      location: dto.location,
      city: dto.city,
      country: dto.country,
      coordinates: [dto.lat, dto.lng],
      isRemote: dto.workMode === 'REMOTE',
      isInstantBook: dto.isInstantBook ?? false,
      status: 'ACTIVE',
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      rateAmount: dto.rateAmount ?? null,
      currency: dto.currency ?? 'EUR',
      paymentType: dto.paymentType
        ? ((dto.paymentType === 'FIXED'
            ? 'PROJECT'
            : dto.paymentType) as unknown as any)
        : ('MONTHLY' as any),
      requiresVehicle: dto.requiresVehicle ?? false,
      requiresDriverLicense: dto.requiresDriverLicense ?? false,
      employer: { connect: { id: employerId } },
      category: { connect: { id: resolvedCategoryId } },
    } as unknown as Prisma.JobCreateInput;

    const created = await this.prisma.job.create({
      data,
      select: {
        id: true,
        title: true,
        location: true,
        city: true,
        country: true,
        coordinates: true,
        isInstantBook: true,
        createdAt: true,
      },
    });
    // Notify nearby job seekers (best-effort)
    void this.notifications.notifyUsersOfNewJobNearby(created.id);
    return { job: created, message: 'Job posted' };
  }

  async updateJob(
    jobId: string,
    employerId: string,
    dto: Partial<{
      title: string;
      description: string;
      requirements: string[];
      responsibilities: string[];
      type: string;
      workMode: string;
      urgency: string;
      status: string;
      salaryMin: number;
      salaryMax: number;
      paymentType: string;
      rateAmount: number;
      currency: string;
      location: string;
      city: string;
      country: string;
      lat: number;
      lng: number;
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      categoryName?: string;
      requiresVehicle?: boolean;
      requiresDriverLicense?: boolean;
    }>,
  ) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { employerId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.employerId !== employerId) {
      throw new ForbiddenException('You can only update your own jobs');
    }

    // Resolve category if provided
    let resolvedCategoryId: string | undefined = dto.categoryId;
    if (!resolvedCategoryId && dto.categoryName) {
      const name = dto.categoryName.trim();
      if (name) {
        // Try to find by exact name first
        let cat = await this.prisma.jobCategory.findFirst({
          where: { name },
          select: { id: true },
        });
        if (!cat) {
          const driverRegex = /^(driver|drivers|driving)$/i;
          const requiresDriverLicense = driverRegex.test(name);
          cat = await this.prisma.jobCategory.create({
            data: { name, requiresDriverLicense, isActive: true },
            select: { id: true },
          });
        }
        resolvedCategoryId = cat.id;
      }
    }
    if (resolvedCategoryId) {
      // Validate category exists
      const cat = await this.prisma.jobCategory.findUnique({
        where: { id: resolvedCategoryId },
        select: { id: true },
      });
      if (!cat) {
        throw new BadRequestException('Invalid categoryId');
      }
    }

    const updateData: Prisma.JobUpdateInput = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description) updateData.description = dto.description;
    if (dto.requirements) updateData.requirements = dto.requirements;
    if (dto.responsibilities)
      updateData.responsibilities = dto.responsibilities;
    // Only update type if it's a valid JobType enum value
    // Frontend might send category name as type, so we need to validate
    const validJobTypes = [
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
      'TEMPORARY',
      'INTERNSHIP',
      'FREELANCE',
      'GIG',
    ];
    if (dto.type && validJobTypes.includes(dto.type)) {
      updateData.type = dto.type as PJobType;
    }
    if (dto.workMode) updateData.workMode = dto.workMode as PWorkMode;
    if (dto.urgency) updateData.urgency = dto.urgency as any;
    if (dto.status) updateData.status = dto.status as any;
    if (dto.salaryMin !== undefined) updateData.salaryMin = dto.salaryMin;
    if (dto.salaryMax !== undefined) updateData.salaryMax = dto.salaryMax;
    if (dto.paymentType) updateData.paymentType = dto.paymentType as any;
    if (dto.rateAmount !== undefined) updateData.rateAmount = dto.rateAmount;
    if (dto.currency) updateData.currency = dto.currency;
    if (dto.location) updateData.location = dto.location;
    if (dto.city) updateData.city = dto.city;
    if (dto.country) updateData.country = dto.country;
    if (dto.lat !== undefined && dto.lng !== undefined) {
      updateData.coordinates = [dto.lat, dto.lng];
    }
    if (dto.startDate) {
      updateData.startDate = new Date(dto.startDate);
    }
    if (dto.endDate) {
      updateData.endDate = new Date(dto.endDate);
    }

    if (dto.requiresVehicle !== undefined)
      updateData.requiresVehicle = dto.requiresVehicle;
    if (dto.requiresDriverLicense !== undefined)
      updateData.requiresDriverLicense = dto.requiresDriverLicense;

    // Update category if resolved
    if (resolvedCategoryId) {
      updateData.category = { connect: { id: resolvedCategoryId } };
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });
    return { job: updated, message: 'Job updated' };
  }

  async updateJobStatus(
    jobId: string,
    employerId: string,
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED',
  ) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { employerId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.employerId !== employerId) {
      throw new ForbiddenException('You can only update your own jobs');
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status },
      select: { id: true, status: true },
    });
    return { job: updated, message: 'Status updated' };
  }

  async deleteJob(jobId: string, employerId: string, reason: string) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/96e993e6-ad5a-4678-89df-a02a7db2d359', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'jobs.service.ts:456',
        message: 'deleteJob called',
        data: { jobId, employerId, reason },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
      }),
    }).catch(() => {});
    // #endregion
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        employerId: true,
        employer: {
          select: {
            firstName: true,
            email: true,
          },
        },
        applications: {
          where: {
            status: {
              not: 'WITHDRAWN',
            },
          },
          select: {
            id: true,
            applicantId: true,
            applicant: {
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
    if (!job) throw new NotFoundException('Job not found');
    if (job.employerId !== employerId) {
      throw new ForbiddenException('You can only delete your own jobs');
    }

    // Update job with deletion reason before deleting (for audit purposes)
    // Since we're deleting, we'll store the reason in a log or handle it differently
    // For now, we'll notify applicants first, then delete

    const jobTitle = job.title;
    const employerName = job.employer.firstName || 'the employer';

    // Notify all applicants
    const notificationPromises = job.applications.map(async (application) => {
      const applicant = application.applicant;
      const applicantName = `${applicant.firstName} ${applicant.lastName}`;

      const t = await this.emailTranslations.getTranslatorForUser(applicant.id);
      const language = await this.emailTranslations.getUserLanguage(
        applicant.id,
      );

      // Create in-app notification
      await this.notifications.createNotification({
        userId: applicant.id,
        type: 'SYSTEM',
        title: t('notifications.templates.jobNoLongerAvailableTitle'),
        body: t('notifications.templates.jobNoLongerAvailableBody', {
          jobTitle,
          reason,
        }),
        payload: {
          jobId: job.id,
          type: 'JOB_DELETED',
        },
      });

      // Send push notification
      await this.notifications.sendPushNotification(
        applicant.id,
        t('notifications.templates.jobNoLongerAvailableTitle'),
        t('notifications.templates.jobNoLongerAvailablePushBody', { jobTitle }),
        {
          type: 'JOB_DELETED',
          jobId: job.id,
        },
      );

      // Send email notification
      const emailSubject = t('email.jobs.jobNoLongerAvailableSubject', {
        jobTitle,
      });
      const emailText = t('email.jobs.jobNoLongerAvailableText', {
        applicantName,
        jobTitle,
        reason,
      });

      const lang = language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';

      const emailHtml = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.jobs.jobNoLongerAvailableTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- Icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; width: 56px; height: 56px; line-height: 56px; font-size: 28px; border-radius: 50%; background-color: rgba(201, 150, 63, 0.15); color: #C9963F; border: 2px solid rgba(201, 150, 63, 0.3);">📋</span>
              </div>

              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600; text-align: center;">${t('email.jobs.jobNoLongerAvailableTitle')}</h2>

              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.greeting', { applicantName })}
              </p>

              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.jobNoLongerAvailableMessage', { jobTitle })}
              </p>

              <!-- Reason Card -->
              <div style="margin: 24px 0; padding: 16px 20px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
                <p style="margin: 0; color: #F5E6C8; font-size: 15px;">
                  <strong>${t('email.jobs.reason')}:</strong>
                  <span style="color: #B8A88A;"> ${reason}</span>
                </p>
              </div>

              <p style="margin: 24px 0 16px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.jobNoLongerAvailableBrowse')}
              </p>

              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.jobNoLongerAvailableAppreciate')}
              </p>

              <p style="margin: 0; color: #8B7A5E; font-size: 15px; line-height: 1.6;">
                ${t('email.common.bestRegards')}<br>
                <strong style="color: #F5E6C8;">${t('email.common.nestaTeam')}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>

        <!-- Copyright -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();

      return this.notifications.sendEmail(
        applicant.email,
        emailSubject,
        emailText,
        emailHtml,
      );
    });

    // Wait for all notifications to be sent
    await Promise.all(notificationPromises);

    // Cancel/delete all bookings related to this job
    // First, find all accepted applications for this job to identify related bookings
    const acceptedApplications = await this.prisma.application.findMany({
      where: {
        jobId: job.id,
        status: 'ACCEPTED',
      },
      select: {
        applicantId: true,
      },
    });
    const acceptedApplicantIds = acceptedApplications.map(
      (app) => app.applicantId,
    );

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/96e993e6-ad5a-4678-89df-a02a7db2d359', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'jobs.service.ts:572',
        message: 'Found accepted applications',
        data: {
          jobId: job.id,
          acceptedCount: acceptedApplications.length,
          applicantIds: acceptedApplicantIds,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H4',
      }),
    }).catch(() => {});
    // #endregion

    // First, notify users about cancelled bookings
    const bookings = await this.prisma.booking.findMany({
      where: { jobId: job.id },
      select: {
        id: true,
        status: true,
        jobSeekerId: true,
        employerId: true,
        jobSeeker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Also find orphaned bookings (jobId: null but related to this job)
    // Match by: employerId + (title OR jobSeekerId from accepted applications)
    // This catches bookings that were created from applications but lost their jobId
    const orphanedWhere: any = {
      jobId: null,
      employerId: job.employerId,
    };

    // Build OR conditions for matching
    const orConditions: any[] = [];
    if (job.title) {
      orConditions.push({ title: job.title });
    }
    if (acceptedApplicantIds.length > 0) {
      orConditions.push({ jobSeekerId: { in: acceptedApplicantIds } });
    }

    if (orConditions.length > 0) {
      orphanedWhere.OR = orConditions;
    }

    const orphanedBookings = await this.prisma.booking.findMany({
      where: orphanedWhere,
      select: {
        id: true,
        status: true,
        jobSeekerId: true,
        employerId: true,
        title: true,
        jobSeeker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/96e993e6-ad5a-4678-89df-a02a7db2d359', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'jobs.service.ts:640',
        message: 'Found orphaned bookings',
        data: {
          jobId: job.id,
          orphanedCount: orphanedBookings.length,
          orphanedIds: orphanedBookings.map((b) => b.id),
          orphanedTitles: orphanedBookings.map((b) => b.title),
          orphanedJobSeekerIds: orphanedBookings.map((b) => b.jobSeekerId),
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H4',
      }),
    }).catch(() => {});
    // #endregion

    // Combine both types of bookings for notifications
    const allBookingsToNotify = [...bookings, ...orphanedBookings];

    // Notify job seekers about cancelled bookings (both with jobId and orphaned)
    for (const booking of allBookingsToNotify) {
      if (booking.status === 'IN_PROGRESS' || booking.status === 'CONFIRMED') {
        await this.notifications.createNotification({
          userId: booking.jobSeekerId,
          type: 'SYSTEM',
          title: (
            await this.emailTranslations.getTranslatorForUser(
              booking.jobSeekerId,
            )
          )('notifications.templates.bookingCancelledTitle'),
          body: (
            await this.emailTranslations.getTranslatorForUser(
              booking.jobSeekerId,
            )
          )('notifications.templates.bookingCancelledBody', { jobTitle }),
          payload: {
            bookingId: booking.id,
            jobId: job.id,
            type: 'BOOKING_CANCELLED',
          },
        });

        await this.notifications.sendPushNotification(
          booking.jobSeekerId,
          (
            await this.emailTranslations.getTranslatorForUser(
              booking.jobSeekerId,
            )
          )('notifications.templates.bookingCancelledTitle'),
          (
            await this.emailTranslations.getTranslatorForUser(
              booking.jobSeekerId,
            )
          )('notifications.templates.bookingCancelledPushBody', { jobTitle }),
          {
            type: 'BOOKING_CANCELLED',
            bookingId: booking.id,
            jobId: job.id,
          },
        );
      }
    }

    // Delete all bookings for this job
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/96e993e6-ad5a-4678-89df-a02a7db2d359', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'jobs.service.ts:644',
        message: 'Before deleting bookings',
        data: {
          jobId: job.id,
          bookingCount: bookings.length,
          orphanedCount: orphanedBookings.length,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
      }),
    }).catch(() => {});
    // #endregion

    // Delete bookings with jobId matching this job
    const deleteResult = await this.prisma.booking.deleteMany({
      where: { jobId: job.id },
    });

    // Also delete orphaned bookings (jobId: null but related to this job)
    let orphanedDeleteResult = { count: 0 };
    if (orphanedBookings.length > 0) {
      orphanedDeleteResult = await this.prisma.booking.deleteMany({
        where: {
          id: { in: orphanedBookings.map((b) => b.id) },
        },
      });
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/96e993e6-ad5a-4678-89df-a02a7db2d359', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'jobs.service.ts:660',
        message: 'After deleting bookings',
        data: {
          jobId: job.id,
          deletedCount: deleteResult.count,
          orphanedDeleted: orphanedDeleteResult.count,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
      }),
    }).catch(() => {});
    // #endregion

    // Delete all applications for this job first (to avoid foreign key constraint violation)
    await this.prisma.application.deleteMany({
      where: { jobId: job.id },
    });

    // Delete the job
    await this.prisma.job.delete({
      where: { id: jobId },
    });

    return {
      message: 'Job deleted',
      notifiedApplicants: job.applications.length,
    };
  }

  async getEmployerJobStats(employerId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { employerId },
      select: { status: true },
    });
    const active = jobs.filter(
      (j) => j.status === 'ACTIVE' || j.status === 'ASSIGNED',
    ).length;
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
    const total = jobs.length;
    return { active, completed, total };
  }

  async getMyJobs(employerId: string, candidateId?: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        employerId,
        // Don't filter by status - return all jobs
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        workMode: true,
        location: true,
        city: true,
        country: true,
        isInstantBook: true,
        createdAt: true,
        coordinates: true,
        urgency: true,
        status: true,
        employerId: true,
        salaryMin: true,
        salaryMax: true,
        paymentType: true,
        rateAmount: true,
        currency: true,
        startDate: true,
        endDate: true,
        requirements: true,
        responsibilities: true,
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If candidateId is provided, check which jobs this candidate has applied to
    let candidateAppliedJobIds: Set<string> = new Set();
    if (candidateId) {
      const applications = await this.prisma.application.findMany({
        where: {
          applicantId: candidateId,
          job: { employerId },
          status: { not: 'WITHDRAWN' },
        },
        select: { jobId: true },
      });
      candidateAppliedJobIds = new Set(applications.map((a) => a.jobId));
    }

    // Fix job statuses for jobs that have accepted applications but status is still ACTIVE
    // This ensures consistency when listing jobs
    // Use a transaction-like approach to avoid race conditions
    const jobsWithFixedStatus = await Promise.all(
      jobs.map(async (job) => {
        if (job.status === 'ACTIVE') {
          // Re-check the job status to avoid race conditions
          const currentJob = await this.prisma.job.findUnique({
            where: { id: job.id },
            select: { status: true },
          });

          // If status was already updated by another request, use the updated status
          if (currentJob && currentJob.status !== 'ACTIVE') {
            return { ...job, status: currentJob.status };
          }

          const acceptedApplication = await this.prisma.application.findFirst({
            where: {
              jobId: job.id,
              status: 'ACCEPTED',
            },
            select: { id: true, completedAt: true },
          });

          if (acceptedApplication) {
            // Double-check status hasn't changed (race condition protection)
            const doubleCheckJob = await this.prisma.job.findUnique({
              where: { id: job.id },
              select: { status: true },
            });

            if (doubleCheckJob && doubleCheckJob.status === 'ACTIVE') {
              // Check if job is completed
              if (acceptedApplication.completedAt) {
                // Update job status to COMPLETED
                await this.prisma.job.update({
                  where: { id: job.id },
                  data: { status: 'COMPLETED' },
                });
                // Lock chat conversations for this job
                await this.chatService.lockConversationsByJobId(job.id);
                return { ...job, status: 'COMPLETED' };
              } else {
                // Update job status to ASSIGNED
                await this.prisma.job.update({
                  where: { id: job.id },
                  data: { status: 'ASSIGNED' },
                });
                return { ...job, status: 'ASSIGNED' };
              }
            } else if (doubleCheckJob) {
              // Status was updated by another request, use the updated status
              return { ...job, status: doubleCheckJob.status };
            }
          }
        }
        return job;
      }),
    );

    return jobsWithFixedStatus.map((job) => ({
      ...job,
      ...(candidateId
        ? { candidateApplied: candidateAppliedJobIds.has(job.id) }
        : {}),
    }));
  }

  async getAllCategories() {
    // Get all categories that have active jobs
    const categoriesWithJobs = await this.prisma.jobCategory.findMany({
      where: {
        isActive: true,
        jobs: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Also get all active categories (even if they don't have jobs yet)
    const allActiveCategories = await this.prisma.jobCategory.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Combine and deduplicate by name
    const categoryMap = new Map<string, { id: string; name: string }>();

    // First add categories with jobs (prioritize them)
    categoriesWithJobs.forEach((cat) => {
      categoryMap.set(cat.name, cat);
    });

    // Then add other active categories
    allActiveCategories.forEach((cat) => {
      if (!categoryMap.has(cat.name)) {
        categoryMap.set(cat.name, cat);
      }
    });

    return Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async createCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Category name is required');
    }

    // Check if category already exists (case-insensitive)
    const existing = await this.prisma.jobCategory.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
      },
    });

    if (existing) {
      return { id: existing.id, name: existing.name };
    }

    const category = await this.prisma.jobCategory.create({
      data: {
        name: trimmed,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return category;
  }
}

// Haversine distance in kilometers
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
