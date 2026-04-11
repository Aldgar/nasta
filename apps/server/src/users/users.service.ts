import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  AdminReviewDeletionDto,
  DeletionRequestDto,
} from './dto/deletion-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';
import { SendReferralDto } from './dto/send-referral.dto';
import { ReferToJobDto } from './dto/refer-to-job.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private emailTranslations: EmailTranslationsService,
    private config: ConfigService,
  ) {}

  async listUsers(options: {
    role?: 'JOB_SEEKER' | 'EMPLOYER';
    limit?: number;
    page?: number;
    search?: string; // Search by email, firstName, or lastName
  }) {
    const { role, limit = 50, page = 1, search } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: role || undefined,
      isActive: true, // Only show active users
      ...(search && {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          avatar: true,
          city: true,
          country: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchUsers(searchQuery: string, currentUserId: string) {
    // Search users by email, firstName, or lastName
    // Exclude the current user
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        isActive: true,
        OR: [
          { email: { contains: searchQuery } },
          { firstName: { contains: searchQuery } },
          { lastName: { contains: searchQuery } },
        ],
      },
      take: 20,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        city: true,
        country: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  async getVerifiedCandidates(params?: { skill?: string }) {
    // Build where clause - only show fully verified candidates
    // All verifications must be complete: email, phone, ID, and background
    // Put ALL conditions in AND array to avoid Prisma interpretation issues
    const andConditions: any[] = [
      { role: 'JOB_SEEKER' },
      { isActive: true },
      { emailVerifiedAt: { not: null } },
      { phoneVerifiedAt: { not: null } },
      // ID verification: must be verified (both flag and status must be correct)
      { isIdVerified: true },
      { idVerificationStatus: 'VERIFIED' },
      // Background verification: must be verified (both flag and status must be correct)
      { isBackgroundVerified: true },
      { backgroundCheckStatus: 'APPROVED' },
    ];

    // Filter by skill if provided
    if (params?.skill) {
      andConditions.push({
        skills: {
          some: {
            skill: {
              name: {
                equals: params.skill,
                mode: 'insensitive',
              },
            },
          },
        },
      });
    }

    const whereClause = {
      AND: andConditions,
    };

    // Log the query for debugging
    this.logger.log(
      '[UsersService] getVerifiedCandidates query:',
      JSON.stringify(whereClause, null, 2),
    );

    // First, let's check what candidates exist without filters
    const allCandidates = await this.prisma.user.findMany({
      where: {
        role: 'JOB_SEEKER',
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        isIdVerified: true,
        idVerificationStatus: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
      },
      take: 10,
    });
    this.logger.log(
      '[UsersService] All candidates (first 10):',
      JSON.stringify(allCandidates, null, 2),
    );

    // Execute query and log results
    const candidates = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        city: true,
        country: true,
        location: true,
        bio: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        isIdVerified: true,
        idVerificationStatus: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
        userProfile: {
          select: {
            bio: true,
            headline: true,
            avatarUrl: true,
            skillsSummary: true,
            links: true,
            city: true,
            country: true,
          },
        },
        skills: {
          select: {
            skill: {
              select: {
                id: true,
                name: true,
              },
            },
            proficiency: true,
            yearsExp: true,
          },
        },
        reviewsReceived: {
          select: {
            rating: true,
          },
        },
        appliedJobs: {
          where: {
            status: {
              not: 'WITHDRAWN',
            },
          },
          select: {
            cvUrl: true,
          },
          orderBy: {
            appliedAt: 'desc',
          },
          take: 1,
          // Get the most recent CV
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Verify each candidate meets all requirements
    this.logger.log(
      `[UsersService] Query returned ${candidates.length} candidates`,
    );
    const verifiedCandidates = candidates.filter((c) => {
      const emailOk = !!c.emailVerifiedAt;
      const phoneOk = !!c.phoneVerifiedAt;
      const idOk =
        c.isIdVerified === true && c.idVerificationStatus === 'VERIFIED';
      const bgOk =
        c.isBackgroundVerified === true &&
        c.backgroundCheckStatus === 'APPROVED';
      const allOk = emailOk && phoneOk && idOk && bgOk;

      if (!allOk) {
        this.logger.error(`[UsersService] ❌ INVALID CANDIDATE RETURNED:`, {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          emailVerified: emailOk,
          phoneVerified: phoneOk,
          idVerified: idOk,
          backgroundVerified: bgOk,
          isIdVerified: c.isIdVerified,
          idVerificationStatus: c.idVerificationStatus,
        });
      }

      return allOk;
    });

    if (verifiedCandidates.length !== candidates.length) {
      this.logger.error(
        `[UsersService] ⚠️ WARNING: Query returned ${candidates.length} candidates but only ${verifiedCandidates.length} are fully verified!`,
      );
      // Filter out invalid candidates
      candidates.splice(0, candidates.length, ...verifiedCandidates);
    }

    this.logger.log(
      `[UsersService] ✅ Returning ${candidates.length} verified candidates`,
    );
    if (candidates.length > 0) {
      candidates.forEach((c, idx) => {
        this.logger.log(`[UsersService] ✅ VERIFIED Candidate ${idx + 1}:`, {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
        });
      });
    } else {
      this.logger.log(
        '[UsersService] ⚠️ No fully verified candidates found. All candidates must have:',
      );
      this.logger.log('  - Email verified');
      this.logger.log('  - Phone verified');
      this.logger.log(
        '  - ID verified (isIdVerified: true, idVerificationStatus: VERIFIED)',
      );
      this.logger.log(
        '  - Background check approved (isBackgroundVerified: true, backgroundCheckStatus: APPROVED)',
      );
    }

    // Calculate average rating for each candidate
    const candidatesWithRating = candidates.map((candidate) => {
      const reviews = candidate.reviewsReceived || [];
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

      // Get CV from most recent application
      const cvUrl =
        candidate.appliedJobs && candidate.appliedJobs.length > 0
          ? candidate.appliedJobs[0].cvUrl
          : null;

      // Get hourly rate, rates, and CV from profile links if available
      const links = candidate.userProfile?.links as
        | {
            hourlyRate?: number;
            cvUrl?: string;
            rates?: Array<{
              rate: number;
              paymentType: string;
              otherSpecification?: string;
            }>;
          }
        | null
        | undefined;
      const hourlyRate = links?.hourlyRate || null;
      const rates =
        links?.rates ||
        (hourlyRate ? [{ rate: hourlyRate, paymentType: 'HOUR' }] : []);
      const profileCvUrl = links?.cvUrl || null;

      // Use CV from application first, then from profile
      const finalCvUrl = cvUrl || profileCvUrl;

      return {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        avatar: candidate.avatar || candidate.userProfile?.avatarUrl || null,
        city: candidate.city || candidate.userProfile?.city,
        country: candidate.country || candidate.userProfile?.country,
        location: candidate.location,
        bio: candidate.bio || candidate.userProfile?.bio,
        headline: candidate.userProfile?.headline,
        skills: candidate.skills.map((s) => ({
          id: s.skill.id,
          name: s.skill.name,
          proficiency: s.proficiency,
          yearsExp: s.yearsExp,
        })),
        skillsSummary: candidate.userProfile?.skillsSummary || [],
        rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        ratingCount: reviews.length,
        cvUrl: finalCvUrl,
        hourlyRate: hourlyRate, // Keep for backward compatibility
        rates: rates, // New rates array with payment types
      };
    });

    // Sort by rating (highest first), then by rating count
    candidatesWithRating.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.ratingCount - a.ratingCount;
    });

    return { candidates: candidatesWithRating };
  }

  async getAllSkills() {
    try {
      // Get all unique skills from the database (even if category is inactive or null)
      const skills = await this.prisma.skill.findMany({
        select: {
          id: true,
          name: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Also get unique skill names from user skills (in case some skills aren't in the Skill table yet)
      const userSkills = await this.prisma.userSkill.findMany({
        select: {
          skill: {
            select: {
              id: true,
              name: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        distinct: ['skillId'],
      });

      // Also get skills from userProfile.skillsSummary
      const userProfiles = await this.prisma.userProfile.findMany({
        where: {
          skillsSummary: {
            isEmpty: false,
          },
        },
        select: {
          skillsSummary: true,
        },
      });

      // Combine and deduplicate by skill name
      const skillMap = new Map<
        string,
        { id: string; name: string; category: { id: string; name: string } }
      >();

      skills.forEach((skill) => {
        if (skill.name && !skillMap.has(skill.name)) {
          skillMap.set(skill.name, {
            id: skill.id,
            name: skill.name,
            category: skill.category || { id: '', name: 'Other' },
          });
        }
      });

      userSkills.forEach((userSkill) => {
        if (
          userSkill.skill &&
          userSkill.skill.name &&
          !skillMap.has(userSkill.skill.name)
        ) {
          skillMap.set(userSkill.skill.name, {
            id: userSkill.skill.id,
            name: userSkill.skill.name,
            category: userSkill.skill.category || { id: '', name: 'Other' },
          });
        }
      });

      // Add skills from skillsSummary
      userProfiles.forEach((profile) => {
        if (profile.skillsSummary && Array.isArray(profile.skillsSummary)) {
          profile.skillsSummary.forEach((skillName) => {
            if (
              typeof skillName === 'string' &&
              skillName.trim() &&
              !skillMap.has(skillName)
            ) {
              skillMap.set(skillName, {
                id: `summary-${skillName}`, // Generate a temporary ID
                name: skillName,
                category: { id: '', name: 'Other' },
              });
            }
          });
        }
      });

      const result = Array.from(skillMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      this.logger.log(
        `[UsersService] getAllSkills returning ${result.length} skills`,
      );
      return result;
    } catch (error) {
      this.logger.error('[UsersService] Error in getAllSkills:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  async getCandidateProfile(candidateId: string, employerId?: string) {
    // Get a single candidate's full profile
    // First try to get verified candidate, but if not found, get any active job seeker
    let candidate = await this.prisma.user.findFirst({
      where: {
        id: candidateId,
        role: 'JOB_SEEKER',
        isActive: true,
        AND: [
          {
            OR: [{ isIdVerified: true }, { idVerificationStatus: 'VERIFIED' }],
          },
          {
            OR: [
              { isBackgroundVerified: true },
              { backgroundCheckStatus: 'APPROVED' },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        city: true,
        country: true,
        location: true,
        bio: true,
        isIdVerified: true,
        idVerificationStatus: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
        userProfile: {
          select: {
            bio: true,
            headline: true,
            avatarUrl: true,
            skillsSummary: true,
            links: true,
            city: true,
            country: true,
          },
        },
        idVerifications: {
          where: {
            status: 'VERIFIED',
            verificationType: 'RESIDENCE_PERMIT',
          },
          select: {
            id: true,
            verificationType: true,
            status: true,
          },
          take: 1,
        },
        skills: {
          select: {
            skill: {
              select: {
                id: true,
                name: true,
              },
            },
            proficiency: true,
            yearsExp: true,
          },
        },
        reviewsReceived: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        appliedJobs: {
          where: {
            status: {
              not: 'WITHDRAWN',
            },
          },
          select: {
            cvUrl: true,
            appliedAt: true,
          },
          orderBy: {
            appliedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // If verified candidate not found, try to get any active job seeker with this ID
    if (!candidate) {
      candidate = await this.prisma.user.findFirst({
        where: {
          id: candidateId,
          role: 'JOB_SEEKER',
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          city: true,
          country: true,
          location: true,
          bio: true,
          isIdVerified: true,
          idVerificationStatus: true,
          isBackgroundVerified: true,
          backgroundCheckStatus: true,
          userProfile: {
            select: {
              bio: true,
              headline: true,
              avatarUrl: true,
              skillsSummary: true,
              links: true,
              city: true,
              country: true,
            },
          },
          idVerifications: {
            where: {
              status: 'VERIFIED',
              verificationType: 'RESIDENCE_PERMIT',
            },
            select: {
              id: true,
              verificationType: true,
              status: true,
            },
            take: 1,
          },
          skills: {
            select: {
              skill: {
                select: {
                  id: true,
                  name: true,
                },
              },
              proficiency: true,
              yearsExp: true,
            },
          },
          reviewsReceived: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              reviewer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          appliedJobs: {
            where: {
              status: {
                not: 'WITHDRAWN',
              },
            },
            select: {
              cvUrl: true,
              appliedAt: true,
            },
            orderBy: {
              appliedAt: 'desc',
            },
            take: 1,
          },
        },
      });
    }

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Get standalone reviews
    const standaloneReviews = ((candidate as any).reviewsReceived || []).map(
      (r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.reviewer,
      }),
    );

    // Get job completion ratings where this candidate was rated by employers
    const completionRatings = await this.prisma.jobCompletionRating.findMany({
      where: {
        application: {
          applicantId: candidate.id,
        },
        raterId: { not: candidate.id }, // Rated by the OTHER party (employer)
      },
      select: {
        id: true,
        otherPartyRating: true,
        otherPartyComment: true,
        createdAt: true,
        rater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Merge both types of reviews into a unified format
    const completionReviews = completionRatings.map((cr) => ({
      id: cr.id,
      rating: cr.otherPartyRating,
      comment: cr.otherPartyComment || null,
      createdAt: cr.createdAt,
      reviewer: cr.rater,
    }));

    const allReviews = [...standaloneReviews, ...completionReviews].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Calculate average rating from all reviews
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
          allReviews.length
        : 0;

    // Get CV from most recent application
    const appliedJobs = (candidate as any).appliedJobs || [];
    const cvUrl = appliedJobs.length > 0 ? appliedJobs[0].cvUrl : null;

    // Get all profile data from links
    const userProfile = (candidate as any).userProfile;
    const links = userProfile?.links as
      | {
          hourlyRate?: number;
          cvUrl?: string;
          languages?: Array<{ language: string; level: string }> | string[];
          rates?: Array<{
            rate: number;
            description?: string;
            paymentType: string;
            otherSpecification?: string;
          }>;
          workExperience?: Array<{
            company: string;
            fromDate: string;
            toDate: string;
            isCurrent: boolean;
            category: string;
            years: string;
            description: string;
          }>;
          certifications?: Array<{
            title: string;
            institution: string;
            graduationDate: string;
            isStillStudying: boolean;
            certificateUri?: string | null;
            certificateName?: string | null;
          }>;
          education?: Array<{
            title: string;
            institution: string;
            graduationDate: string;
            isStillStudying: boolean;
            certificateUri?: string | null;
            certificateName?: string | null;
          }>;
          projects?: Array<{
            title: string;
            description: string;
            url?: string;
          }>;
          categories?: string[];
        }
      | null
      | undefined;
    const hourlyRate = links?.hourlyRate || null;
    const rates =
      links?.rates ||
      (hourlyRate ? [{ rate: hourlyRate, paymentType: 'HOUR' }] : []);
    const profileCvUrl = links?.cvUrl || null;
    // Return languages with levels if available, otherwise just names
    const languages =
      Array.isArray(links?.languages) && links.languages.length > 0
        ? typeof links.languages[0] === 'string'
          ? (links.languages as string[])
          : (links.languages as Array<{ language: string; level: string }>)
        : [];

    // Use CV from application first, then from profile
    const finalCvUrl = cvUrl || profileCvUrl;

    // Fetch availability for this candidate
    const availability = await this.prisma.availability.findMany({
      where: { userId: candidate.id },
      orderBy: { start: 'asc' },
      take: 100, // Limit to next 100 availability slots
      select: {
        id: true,
        start: true,
        end: true,
        timezone: true,
        isRecurring: true,
        rrule: true,
      },
    });

    // Check if candidate has applied or been referred to any of the employer's jobs (if employerId is provided)
    const applicationInfo: {
      hasApplied: boolean;
      hasBeenReferred: boolean;
      applicationId?: string;
      referralId?: string;
      jobId?: string;
      paymentStatus?: {
        required: boolean;
        completed: boolean;
        paymentId?: string;
        paymentIntentId?: string;
        clientSecret?: string;
      };
    } = { hasApplied: false, hasBeenReferred: false };

    if (employerId) {
      // First check if candidate has applied
      const application = await this.prisma.application.findFirst({
        where: {
          applicantId: candidate.id,
          job: {
            employerId: employerId,
          },
          status: {
            not: 'WITHDRAWN',
          },
        },
        select: {
          id: true,
          job: {
            select: {
              id: true,
              rateAmount: true,
              currency: true,
              paymentType: true,
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              stripePaymentIntentId: true,
            },
          },
        },
        orderBy: {
          appliedAt: 'desc',
        },
      });

      if (application) {
        applicationInfo.hasApplied = true;
        applicationInfo.applicationId = application.id;
        applicationInfo.jobId = application.job.id;

        // Check payment status
        const paymentRequired =
          !!application.job.rateAmount && application.job.rateAmount > 0;
        if (paymentRequired) {
          const paymentCompleted = application.payment?.status === 'SUCCEEDED';
          applicationInfo.paymentStatus = {
            required: true,
            completed: paymentCompleted,
            paymentId: application.payment?.id,
            paymentIntentId:
              application.payment?.stripePaymentIntentId || undefined,
          };
        } else {
          applicationInfo.paymentStatus = {
            required: false,
            completed: true,
          };
        }
      } else {
        // If not applied, check if candidate has been referred
        const referral = await this.prisma.jobReferral.findFirst({
          where: {
            candidateId: candidate.id,
            employerId: employerId,
            job: {
              status: 'ACTIVE',
            },
          },
          select: {
            id: true,
            jobId: true,
            applicationId: true,
            job: {
              select: {
                id: true,
                rateAmount: true,
                currency: true,
                paymentType: true,
              },
            },
            application: {
              select: {
                id: true,
                payment: {
                  select: {
                    id: true,
                    status: true,
                    stripePaymentIntentId: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (referral) {
          applicationInfo.hasBeenReferred = true;
          applicationInfo.referralId = referral.id;
          applicationInfo.jobId = referral.jobId;

          if (referral.applicationId && referral.application) {
            applicationInfo.applicationId = referral.application.id;

            // Check payment status
            const paymentRequired =
              !!referral.job.rateAmount && referral.job.rateAmount > 0;
            if (paymentRequired) {
              const paymentCompleted =
                referral.application.payment?.status === 'SUCCEEDED';
              applicationInfo.paymentStatus = {
                required: true,
                completed: paymentCompleted,
                paymentId: referral.application.payment?.id,
                paymentIntentId:
                  referral.application.payment?.stripePaymentIntentId ||
                  undefined,
              };
            } else {
              applicationInfo.paymentStatus = {
                required: false,
                completed: true,
              };
            }
          } else {
            // Referred but no application yet (shouldn't happen, but handle it)
            const paymentRequired =
              !!referral.job.rateAmount && referral.job.rateAmount > 0;
            applicationInfo.paymentStatus = {
              required: paymentRequired,
              completed: false,
            };
          }
        }
      }
    }

    // Fetch verified vehicles for this candidate
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId: candidate.id, status: 'VERIFIED' },
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

    const dlVerified = await this.prisma.idVerification.findFirst({
      where: {
        userId: candidate.id,
        verificationType: 'DRIVERS_LICENSE',
        status: 'VERIFIED',
      },
      select: {
        documentFrontUrl: true,
        documentBackUrl: true,
        documentExpiry: true,
      },
    });
    const hasVerifiedDriversLicense = !!(
      dlVerified?.documentFrontUrl &&
      dlVerified?.documentBackUrl &&
      (!dlVerified.documentExpiry || dlVerified.documentExpiry > new Date())
    );

    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      phone: candidate.phone,
      avatar: candidate.avatar || userProfile?.avatarUrl || null,
      city: candidate.city || userProfile?.city,
      country: candidate.country || userProfile?.country,
      location: candidate.location,
      bio: candidate.bio || userProfile?.bio,
      headline: userProfile?.headline,
      skills: ((candidate as any).skills || []).map((s: any) => ({
        id: s.skill.id,
        name: s.skill.name,
        proficiency: s.proficiency,
        yearsExp: s.yearsExp,
      })),
      skillsSummary: userProfile?.skillsSummary || [],
      languages: languages,
      rating: Math.round(avgRating * 10) / 10,
      ratingCount: allReviews.length,
      reviews: allReviews,
      cvUrl: finalCvUrl,
      hourlyRate: hourlyRate,
      rates: rates,
      workExperience: links?.workExperience || [],
      certifications: links?.certifications || [],
      education: links?.education || [],
      projects: links?.projects || [],
      categories: links?.categories || [],
      // Verification statuses
      isIdVerified: (candidate as any).isIdVerified,
      idVerificationStatus: (candidate as any).idVerificationStatus,
      isBackgroundVerified: (candidate as any).isBackgroundVerified,
      backgroundCheckStatus: (candidate as any).backgroundCheckStatus,
      hasWorkPermit:
        (candidate as any).idVerifications &&
        (candidate as any).idVerifications.length > 0,
      // Verified vehicles
      vehicles,
      hasVerifiedVehicle: vehicles.length > 0,
      hasVerifiedDriversLicense,
      // Availability
      availability: availability.map((slot) => ({
        id: slot.id,
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        timezone: slot.timezone,
        isRecurring: slot.isRecurring,
        rrule: slot.rrule,
      })),
      // Application info for employer view
      applicationInfo:
        applicationInfo.hasApplied || applicationInfo.hasBeenReferred
          ? applicationInfo
          : undefined,
    };
  }

  async updateUserAdmin(userId: string, dto: AdminUpdateUserDto) {
    const data: Record<string, unknown> = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          phone: true,
          updatedAt: true,
        },
      });
      return updated;
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async updateAddress(
    currentUserId: string,
    dto: {
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      location?: string; // Legacy field
      lat?: number;
      lng?: number;
    },
  ) {
    const userData: Record<string, unknown> = {};
    const profileData: Record<string, unknown> = {};

    // New address fields - save to UserProfile
    if (dto.addressLine1 !== undefined)
      profileData.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined)
      profileData.addressLine2 = dto.addressLine2;
    if (dto.city !== undefined) {
      profileData.city = dto.city;
      userData.city = dto.city; // Also update User for backwards compatibility
    }
    if (dto.state !== undefined) profileData.state = dto.state;
    if (dto.postalCode !== undefined) profileData.postalCode = dto.postalCode;
    if (dto.country !== undefined) {
      profileData.country = dto.country;
      userData.country = dto.country; // Also update User for backwards compatibility
    }

    // Legacy location field - save to User for backwards compatibility
    if (dto.location !== undefined) userData.location = dto.location;

    // Coordinates handling
    if (
      (dto.lat !== undefined && typeof dto.lat !== 'number') ||
      (dto.lng !== undefined && typeof dto.lng !== 'number')
    ) {
      throw new BadRequestException('lat and lng must be numbers');
    }
    if (
      (dto.lat !== undefined && dto.lng === undefined) ||
      (dto.lng !== undefined && dto.lat === undefined)
    ) {
      throw new BadRequestException('Provide both lat and lng together');
    }
    if (dto.lat !== undefined && dto.lng !== undefined) {
      if (dto.lat < -90 || dto.lat > 90 || dto.lng < -180 || dto.lng > 180) {
        throw new BadRequestException('Invalid lat/lng values');
      }
      userData.coordinates = [dto.lat, dto.lng];
      profileData.lat = dto.lat;
      profileData.lng = dto.lng;
    }

    if (
      Object.keys(userData).length === 0 &&
      Object.keys(profileData).length === 0
    ) {
      throw new BadRequestException('No address fields to update');
    }

    // Update User (for backwards compatibility)
    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id: currentUserId },
        data: userData,
      });
    }

    // Update or create UserProfile
    if (Object.keys(profileData).length > 0) {
      await this.prisma.userProfile.upsert({
        where: { userId: currentUserId },
        update: profileData,
        create: {
          userId: currentUserId,
          ...profileData,
        },
        select: {
          id: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          lat: true,
          lng: true,
          updatedAt: true,
        },
      });
    }

    // Fetch updated profile data
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: currentUserId },
      select: {
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        lat: true,
        lng: true,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        location: true,
        city: true,
        country: true,
        coordinates: true,
      },
    });

    return {
      profile: {
        ...profile,
        ...user,
      },
      message: 'Address updated',
    };
  }

  async getUserDetailsForAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        bio: true,
        location: true,
        city: true,
        country: true,
        isActive: true,
        isVerified: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        isIdVerified: true,
        idVerificationStatus: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get ratings/reviews
    const reviews = await this.prisma.review.findMany({
      where: {
        OR: [{ revieweeId: userId }, { reviewerId: userId }],
      },
      include: {
        reviewee: {
          select: { id: true, firstName: true, lastName: true },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    // Get bookings (for service providers: ongoing services)
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [{ jobSeekerId: userId }, { employerId: userId }],
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
        },
      },
      include: {
        job: {
          select: { id: true, title: true },
        },
        jobSeeker: {
          select: { id: true, firstName: true, lastName: true },
        },
        employer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { bookedAt: 'desc' },
      take: 10,
    });

    // Get jobs (for employers: their posts)
    const jobs =
      user.role === 'EMPLOYER'
        ? await this.prisma.job.findMany({
            where: { employerId: userId },
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : [];

    // Get issues reported against this user
    const reportedIssues = await this.prisma.supportTicket.findMany({
      where: {
        OR: [
          { message: { contains: userId } },
          { subject: { contains: user.email } },
        ],
        category: {
          in: ['ABUSE', 'SECURITY', 'REPORT'],
        },
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        category: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get account creation stats (for service providers: platform growth visibility)
    const accountStats =
      user.role === 'JOB_SEEKER'
        ? {
            totalServiceProviders: await this.prisma.user.count({
              where: { role: 'JOB_SEEKER', isActive: true },
            }),
            totalThisMonth: await this.prisma.user.count({
              where: {
                role: 'JOB_SEEKER',
                isActive: true,
                createdAt: {
                  gte: new Date(new Date().setDate(1)),
                },
              },
            }),
          }
        : null;

    // KYC: ID verifications for this user
    const kycVerifications = await this.prisma.idVerification.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        verificationType: true,
        documentType: true,
        documentNumber: true,
        documentCountry: true,
        documentExpiry: true,
        documentFrontUrl: true,
        documentBackUrl: true,
        selfieUrl: true,
        confidence: true,
        faceMatch: true,
        livenessCheck: true,
        extractedData: true,
        extractedBy: true,
        extractedAt: true,
        certifications: true,
        cvDocuments: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Vehicles for this user
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId },
      select: {
        id: true,
        vehicleType: true,
        otherTypeSpecification: true,
        make: true,
        model: true,
        year: true,
        color: true,
        licensePlate: true,
        capacity: true,
        photoFrontUrl: true,
        photoBackUrl: true,
        photoLeftUrl: true,
        photoRightUrl: true,
        vehicleLicenseUrl: true,
        status: true,
        adminNotes: true,
        reviewedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // All support tickets BY this user
    const supportTickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        message: true,
        category: true,
        status: true,
        priority: true,
        assignedTo: true,
        assignedAt: true,
        resolvedBy: true,
        resolvedAt: true,
        resolution: true,
        adminNotes: true,
        conversationId: true,
        createdAt: true,
        updatedAt: true,
        responses: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            message: true,
            channel: true,
            createdAt: true,
            adminId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const result = {
      user,
      stats: {
        rating: Math.round(avgRating * 10) / 10,
        ratingCount: reviews.length,
        activeBookings: bookings.length,
        totalJobs: jobs.length,
        reportedIssues: reportedIssues.length,
      },
      reviews: reviews.slice(0, 5),
      bookings: bookings.slice(0, 5),
      jobs: jobs.slice(0, 5),
      reportedIssues: reportedIssues.slice(0, 5),
      kycVerifications,
      vehicles,
      supportTickets,
      accountStats,
    };
    console.log(
      '[getUserDetailsForAdmin] Returning keys:',
      Object.keys(result),
      'kyc:',
      kycVerifications.length,
      'veh:',
      vehicles.length,
      'tix:',
      supportTickets.length,
    );
    return result;
  }

  /**
   * Check if a user has restrictions (banned, suspended, or restricted)
   * Returns null if no restrictions, or an object with restriction details
   */
  async checkUserRestrictions(userId: string): Promise<{
    isBanned: boolean;
    isSuspended: boolean;
    isRestricted: boolean;
    restrictionReason?: string;
    restrictions?: {
      canPostJobs?: boolean;
      canApplyToJobs?: boolean;
      canBookJobs?: boolean;
    };
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        idVerificationData: true,
      },
    });

    if (!user) {
      return null;
    }

    // If account is inactive, check if it's banned or suspended
    if (!user.isActive) {
      const data = user.idVerificationData as any;
      if (data?.banned) {
        return {
          isBanned: true,
          isSuspended: false,
          isRestricted: false,
          restrictionReason: data.banReason || 'Account banned',
        };
      }
      if (data?.suspended) {
        return {
          isBanned: false,
          isSuspended: true,
          isRestricted: false,
          restrictionReason: data.suspendReason || 'Account suspended',
        };
      }
      // Inactive but no specific reason - treat as suspended
      return {
        isBanned: false,
        isSuspended: true,
        isRestricted: false,
        restrictionReason: 'Account is inactive',
      };
    }

    // Check for restrictions (account is active but has restrictions)
    const data = user.idVerificationData as any;
    if (data?.restricted) {
      return {
        isBanned: false,
        isSuspended: false,
        isRestricted: true,
        restrictionReason:
          data.restrictionReason || 'Account access restricted',
        restrictions: data.restrictions || {
          canPostJobs: false,
          canApplyToJobs: false,
          canBookJobs: false,
        },
      };
    }

    return null;
  }

  async recordLegalAction(
    userId: string,
    dto: { actionType: string; reason: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate ticket number
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;
    const lastTicket = await this.prisma.supportTicket.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(
        lastTicket.ticketNumber.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    const ticketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;

    // Create a support ticket for legal action tracking
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: userId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        subject: `Legal Action: ${dto.actionType} - ${user.firstName} ${user.lastName}`,
        message: `Legal Action Type: ${dto.actionType}\n\nReason: ${dto.reason}\n\nUser: ${user.email}`,
        category: 'SECURITY',
        priority: 'URGENT',
        status: 'OPEN',
      },
    });

    // Apply the actual action based on type
    if (dto.actionType === 'BAN') {
      // BAN: Permanently deactivate account - blocks all access
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          // Store ban metadata in idVerificationData for tracking
          idVerificationData: {
            banned: true,
            bannedAt: new Date().toISOString(),
            banReason: dto.reason,
            actionType: 'BAN',
          } as any,
        },
      });
    } else if (dto.actionType === 'SUSPEND') {
      // SUSPEND: Temporarily deactivate account - blocks all access but can be reversed
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          // Store suspension metadata
          idVerificationData: {
            suspended: true,
            suspendedAt: new Date().toISOString(),
            suspendReason: dto.reason,
            actionType: 'SUSPEND',
          } as any,
        },
      });
    } else if (dto.actionType === 'RESTRICT') {
      // RESTRICT: Keep account active but restrict certain features
      // Store restriction metadata without deactivating account
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          // Keep isActive: true so user can still log in
          // Store restriction metadata
          idVerificationData: {
            restricted: true,
            restrictedAt: new Date().toISOString(),
            restrictionReason: dto.reason,
            actionType: 'RESTRICT',
            // Restrictions: can't post jobs, can't apply to jobs, etc.
            restrictions: {
              canPostJobs: false,
              canApplyToJobs: false,
              canBookJobs: false,
            },
          } as any,
        },
      });
    }

    // Send personalized notification email
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const actionDescription = t(
        `email.legal.actionDescription.${dto.actionType.toLowerCase()}`,
      );

      const actionColor =
        dto.actionType === 'BAN'
          ? '#ef4444'
          : dto.actionType === 'SUSPEND'
            ? '#f59e0b'
            : '#D4A853';

      // Build email content with branded template
      const emailContent = `
        <p style="color: #D4A853; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${actionDescription}.</p>
        <div style="background-color: ${actionColor === '#ef4444' ? 'rgba(239, 68, 68, 0.08)' : actionColor === '#f59e0b' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(201, 150, 63, 0.08)'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${actionColor}; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #F5E6C8; font-weight: 600;">${t('email.legal.actionDetails')}:</p>
          <p style="margin: 5px 0; color: #B8A88A;"><strong>${t('email.legal.actionType')}:</strong> ${dto.actionType}</p>
          <p style="margin: 5px 0; color: #B8A88A;"><strong>${t('email.kyc.reason')}:</strong> ${dto.reason}</p>
          <p style="margin: 10px 0 0 0; color: #8B7A5E; font-size: 13px;">${t('email.legal.date')}: ${new Date().toLocaleDateString(t('email.common.locale'), { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        ${
          dto.actionType === 'RESTRICT'
            ? `<p style="color: #D4A853; font-size: 14px; line-height: 1.6; margin-top: 20px;">${t('email.legal.restrictMessage')}</p>`
            : `<p style="color: #D4A853; font-size: 14px; line-height: 1.6; margin-top: 20px;">${t('email.legal.actionTakenMessage')}</p>`
        }
      `;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        t('email.legal.actionTitle', { actionType: dto.actionType }),
        t('email.legal.actionGreeting', {
          firstName: user.firstName || t('email.common.there'),
        }),
        emailContent,
        t('email.legal.actionFooter'),
      );

      await this.notifications.sendEmail(
        user.email,
        `⚠️ ${t('email.legal.actionTitle', { actionType: dto.actionType })}`,
        `${t('email.legal.actionGreeting', { firstName: user.firstName || t('email.common.there') })}\n\n${actionDescription}.\n\n${t('email.legal.actionType')}: ${dto.actionType}\n${t('email.kyc.reason')}: ${dto.reason}\n\n${t('email.legal.actionTakenMessage')}\n\n${t('email.legal.actionFooter')}\n\n${t('email.common.bestRegards')}\n${t('email.common.nestaTeam')}`,
        emailHtml,
      );
    } catch (emailError) {
      this.logger.error('Failed to send legal action email:', emailError);
    }

    // Create notification and send push notification
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const notification = await this.notifications.createNotification({
        userId: userId,
        type: 'LEGAL_ACTION',
        title: t('email.legal.actionNotificationTitle', {
          actionType: dto.actionType,
        }),
        body: t('email.legal.actionNotificationBody', {
          actionType: dto.actionType,
          reason: dto.reason,
        }),
        payload: {
          actionType: dto.actionType,
          reason: dto.reason,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        },
      });
      this.logger.log('✅ Legal action notification created:', notification);
    } catch (notifError) {
      this.logger.error(
        '❌ Failed to create notification for legal action:',
        notifError,
      );
    }

    return {
      success: true,
      message: 'Legal action recorded',
      ticketId: ticket.id,
    };
  }

  async issueWarning(
    userId: string,
    dto: { warningType: string; message: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate ticket number
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;
    const lastTicket = await this.prisma.supportTicket.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(
        lastTicket.ticketNumber.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    const ticketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;

    // Create a support ticket for warning tracking
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: userId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        subject: `Warning: ${dto.warningType} - ${user.firstName} ${user.lastName}`,
        message: `Warning Type: ${dto.warningType}\n\nMessage: ${dto.message}\n\nUser: ${user.email}`,
        category: 'ABUSE',
        priority: 'HIGH',
        status: 'OPEN',
      },
    });

    // Send personalized warning email
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const language = await this.emailTranslations.getUserLanguage(userId);
      const normalizedLang = language?.toLowerCase().startsWith('pt')
        ? 'pt'
        : 'en';

      const warningEmoji =
        dto.warningType === 'FINAL'
          ? '🚨'
          : dto.warningType === 'MAJOR'
            ? '⚠️'
            : '⚠';
      const warningSeverityKey =
        dto.warningType === 'FINAL'
          ? 'email.legal.finalWarningSeverity'
          : dto.warningType === 'MAJOR'
            ? 'email.legal.majorWarningSeverity'
            : 'email.legal.minorWarningSeverity';
      const warningSeverity = t(warningSeverityKey);

      await this.notifications.sendEmail(
        user.email,
        t('email.legal.warningSubject', {
          warningType: dto.warningType,
          warningEmoji,
        }),
        t('email.legal.warningText', {
          firstName: user.firstName,
          lastName: user.lastName,
          warningType: dto.warningType,
          warningSeverity,
          message: dto.message,
        }),
        this.notifications.getBrandedEmailTemplate(
          t('email.legal.warningTitle', { warningEmoji }),
          t('email.legal.warningGreeting', {
            firstName: user.firstName,
            lastName: user.lastName,
          }),
          `<p style="color: #D4A853; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${t('email.legal.warningReceived', { warningType: dto.warningType })}</p>
           <div style="background-color: ${dto.warningType === 'FINAL' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'}; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
             <p style="margin: 0 0 10px 0; color: #fbbf24; font-weight: 700; font-size: 14px; text-transform: uppercase;">${warningSeverity}</p>
             <p style="margin: 10px 0 0 0; color: #D4A853; font-weight: 600;">${t('email.legal.warningMessageLabel')}:</p>
             <p style="margin: 10px 0 0 0; color: #fbbf24; line-height: 1.6;">${dto.message}</p>
             <p style="margin: 15px 0 0 0; color: #fbbf24; font-size: 13px;">${t('email.legal.date')}: ${new Date().toLocaleDateString(t('email.common.locale'), { year: 'numeric', month: 'long', day: 'numeric' })}</p>
           </div>
           <p style="color: #D4A853; font-size: 14px; line-height: 1.6; margin-top: 20px;">${t('email.legal.warningComplianceMessage')}</p>
           <p style="color: #8B7A5E; font-size: 14px; line-height: 1.6; margin-top: 15px;">${t('email.legal.warningContactMessage')}</p>`,
          t('email.common.supportMessage'),
          t,
          normalizedLang,
        ),
      );
    } catch (emailError) {
      this.logger.error('Failed to send warning email:', emailError);
    }

    // Create notification and send push notification
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const notification = await this.notifications.createNotification({
        userId: userId,
        type: 'WARNING',
        title: t('email.legal.warningNotificationTitle', {
          warningType: dto.warningType,
        }),
        body: dto.message,
        payload: {
          warningType: dto.warningType,
          message: dto.message,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        },
      });
      this.logger.log('✅ Warning notification created:', notification);
    } catch (notifError) {
      this.logger.error(
        '❌ Failed to create notification for warning:',
        notifError,
      );
    }

    return {
      success: true,
      message: 'Warning issued',
      ticketId: ticket.id,
    };
  }

  async submitActionForm(
    userId: string,
    dto: { actionType: string; details: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate ticket number
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;
    const lastTicket = await this.prisma.supportTicket.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(
        lastTicket.ticketNumber.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    const ticketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;

    // Create a support ticket for action form tracking
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: userId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        subject: `Action Form: ${dto.actionType} - ${user.firstName} ${user.lastName}`,
        message: `Action Type: ${dto.actionType}\n\nDetails: ${dto.details}\n\nUser: ${user.email}`,
        category: 'GENERAL',
        priority: 'NORMAL',
        status: 'OPEN',
      },
    });

    // Send personalized action form email
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const language = await this.emailTranslations.getUserLanguage(userId);
      const normalizedLang = language?.toLowerCase().startsWith('pt')
        ? 'pt'
        : 'en';

      const actionTypeDescriptionKey =
        dto.actionType === 'NOTICE'
          ? 'email.actionForm.notice'
          : dto.actionType === 'REQUIREMENT'
            ? 'email.actionForm.requirement'
            : 'email.actionForm.investigation';
      const actionTypeDescription = t(actionTypeDescriptionKey);

      await this.notifications.sendEmail(
        user.email,
        t('email.actionForm.subject', {
          actionType: actionTypeDescription,
          firstName: user.firstName,
          lastName: user.lastName,
        }),
        t('email.actionForm.text', {
          firstName: user.firstName,
          lastName: user.lastName,
          actionType: actionTypeDescription,
          details: dto.details,
        }),
        this.notifications.getBrandedEmailTemplate(
          t('email.actionForm.title'),
          t('email.actionForm.greeting', {
            firstName: user.firstName,
            lastName: user.lastName,
          }),
          `<p style="color: #D4A853; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${t('email.actionForm.submittedMessage')}</p>
           <div style="background-color: rgba(16, 185, 129, 0.08); padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
             <p style="margin: 0 0 10px 0; color: #F5E6C8; font-weight: 600;">${t('email.actionForm.actionTypeLabel')}:</p>
             <p style="margin: 0 0 20px 0; color: #34d399; font-size: 18px; font-weight: 700;">${actionTypeDescription}</p>
             <p style="margin: 10px 0 0 0; color: #F5E6C8; font-weight: 600;">${t('email.actionForm.detailsLabel')}:</p>
             <p style="margin: 10px 0 0 0; color: #34d399; line-height: 1.6;">${dto.details}</p>
             <p style="margin: 15px 0 0 0; color: #6ee7b7; font-size: 13px;">${t('email.common.date', { date: new Date().toLocaleDateString(t('email.common.locale'), { year: 'numeric', month: 'long', day: 'numeric' }) })}</p>
           </div>
           <p style="color: #D4A853; font-size: 14px; line-height: 1.6; margin-top: 20px;">${t('email.actionForm.reviewMessage')}</p>`,
          t('email.common.supportMessage'),
          t,
          normalizedLang,
        ),
      );
    } catch (emailError) {
      this.logger.error('Failed to send action form email:', emailError);
    }

    // Create notification and send push notification
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const actionTypeDescriptionKey =
        dto.actionType === 'NOTICE'
          ? 'email.actionForm.notice'
          : dto.actionType === 'REQUIREMENT'
            ? 'email.actionForm.requirement'
            : 'email.actionForm.investigation';
      const actionTypeDescription = t(actionTypeDescriptionKey);
      const notification = await this.notifications.createNotification({
        userId: userId,
        type: 'ACTION_FORM',
        title: t('email.actionForm.notificationTitle', {
          actionType: dto.actionType,
        }),
        body: t('email.actionForm.notificationBody', {
          actionType: actionTypeDescription,
        }),
        payload: {
          actionType: dto.actionType,
          details: dto.details,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        },
      });
      this.logger.log('✅ Action form notification created:', notification);
    } catch (notifError) {
      this.logger.error(
        '❌ Failed to create notification for action form:',
        notifError,
      );
    }

    return {
      success: true,
      message: 'Action form submitted',
      ticketId: ticket.id,
    };
  }

  async requestInfo(userId: string, dto: { request: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate ticket number
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;
    const lastTicket = await this.prisma.supportTicket.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(
        lastTicket.ticketNumber.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    const ticketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;

    // Create a support ticket for request info tracking
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: userId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        subject: `Request Information: ${user.firstName} ${user.lastName}`,
        message: `Admin Request: ${dto.request}\n\nUser: ${user.email}`,
        category: 'GENERAL',
        priority: 'NORMAL',
        status: 'OPEN',
      },
    });

    // Create notification and send push notification
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const notification = await this.notifications.createNotification({
        userId: userId,
        type: 'SYSTEM',
        title: t('notifications.templates.adminInfoRequestTitle'),
        body: t('notifications.templates.adminInfoRequestBody', {
          request: dto.request,
        }),
        payload: {
          request: dto.request,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        },
      });
      this.logger.log('✅ Request info notification created:', notification);
    } catch (notifError) {
      this.logger.error(
        '❌ Failed to create notification for request info:',
        notifError,
      );
    }

    return {
      success: true,
      message: 'Information request sent',
      ticketId: ticket.id,
    };
  }

  async getUserActions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all actions (support tickets with specific patterns)
    const actions = await this.prisma.supportTicket.findMany({
      where: {
        userId: userId,
        OR: [
          { subject: { contains: 'Legal Action:' } },
          { subject: { contains: 'Warning:' } },
          { subject: { contains: 'Action Form:' } },
          { subject: { contains: 'Admin Request:' } },
          { subject: { contains: 'Request Information:' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        message: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        ticketNumber: true,
      },
    });

    // Parse actions into structured format
    const parsedActions = actions.map((ticket) => {
      let actionType = 'UNKNOWN';
      const actionData: any = {};

      if (ticket.subject.includes('Legal Action:')) {
        actionType = 'LEGAL_ACTION';
        const match = ticket.subject.match(/Legal Action: (\w+)/);
        actionData.actionType = match ? match[1] : 'UNKNOWN';
        const reasonMatch = ticket.message.match(/Reason:\s*(.+?)(?:\n|$)/);
        actionData.reason = reasonMatch ? reasonMatch[1].trim() : '';
      } else if (ticket.subject.includes('Warning:')) {
        actionType = 'WARNING';
        const match = ticket.subject.match(/Warning: (\w+)/);
        actionData.warningType = match ? match[1] : 'UNKNOWN';
        const messageMatch = ticket.message.match(/Message:\s*(.+?)(?:\n|$)/);
        actionData.message = messageMatch ? messageMatch[1].trim() : '';
      } else if (ticket.subject.includes('Action Form:')) {
        actionType = 'ACTION_FORM';
        const match = ticket.subject.match(/Action Form: (\w+)/);
        actionData.actionType = match ? match[1] : 'UNKNOWN';
        const detailsMatch = ticket.message.match(/Details:\s*(.+?)(?:\n|$)/);
        actionData.details = detailsMatch ? detailsMatch[1].trim() : '';
      } else if (
        ticket.subject.includes('Request Information:') ||
        ticket.message.includes('Admin Request:')
      ) {
        actionType = 'REQUEST_INFO';
        const requestMatch = ticket.message.match(
          /Admin Request:\s*(.+?)(?:\n|$)/,
        );
        actionData.request = requestMatch
          ? requestMatch[1].trim()
          : ticket.message;
      }

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        actionType,
        actionData,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
        isActive: ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS',
      };
    });

    return {
      actions: parsedActions,
      total: parsedActions.length,
      active: parsedActions.filter((a) => a.isActive).length,
    };
  }

  async revokeAction(userId: string, actionId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: actionId,
        userId: userId,
        OR: [
          { subject: { contains: 'Legal Action:' } },
          { subject: { contains: 'Warning:' } },
          { subject: { contains: 'Action Form:' } },
        ],
      },
    });

    if (!ticket) {
      throw new NotFoundException('Action not found');
    }

    // Determine action type
    const actionData: any = {};

    if (ticket.subject.includes('Legal Action:')) {
      const match = ticket.subject.match(/Legal Action: (\w+)/);
      actionData.actionType = match ? match[1] : 'UNKNOWN';

      // Get current user data to check what restrictions exist
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { idVerificationData: true },
      });

      const currentData = (user?.idVerificationData as any) || {};

      // If it was a BAN or SUSPEND, reactivate the user and clear ban/suspend metadata
      if (
        actionData.actionType === 'BAN' ||
        actionData.actionType === 'SUSPEND'
      ) {
        const updatedData = { ...currentData };
        delete updatedData.banned;
        delete updatedData.bannedAt;
        delete updatedData.banReason;
        delete updatedData.suspended;
        delete updatedData.suspendedAt;
        delete updatedData.suspendReason;
        // Keep other metadata but remove action type if it matches
        if (updatedData.actionType === actionData.actionType) {
          delete updatedData.actionType;
        }

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            isActive: true,
            idVerificationData: updatedData as any,
          },
        });
      } else if (actionData.actionType === 'RESTRICT') {
        // If it was a RESTRICT, remove restriction metadata but keep account active
        const updatedData = { ...currentData };
        delete updatedData.restricted;
        delete updatedData.restrictedAt;
        delete updatedData.restrictionReason;
        delete updatedData.restrictions;
        // Keep other metadata but remove action type if it matches
        if (updatedData.actionType === actionData.actionType) {
          delete updatedData.actionType;
        }

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            idVerificationData: updatedData as any,
          },
        });
      }
    } else if (ticket.subject.includes('Warning:')) {
      // Warning type determined
    } else if (ticket.subject.includes('Action Form:')) {
      // Action form type determined
    }

    // Update ticket status to CLOSED
    const updated = await this.prisma.supportTicket.update({
      where: { id: actionId },
      data: {
        status: 'CLOSED',
        resolution: 'Action revoked by admin',
      },
    });

    // Send notification email
    try {
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const language = await this.emailTranslations.getUserLanguage(userId);
      const normalizedLang = language?.toLowerCase().startsWith('pt')
        ? 'pt'
        : 'en';

      await this.notifications.sendEmail(
        user.email,
        t('email.legal.actionRevokedSubject', { subject: ticket.subject }),
        t('email.legal.actionRevokedText', {
          firstName: user.firstName,
          subject: ticket.subject,
        }),
        this.notifications.getBrandedEmailTemplate(
          t('email.legal.actionRevokedTitle'),
          t('email.legal.actionRevokedGreeting', { firstName: user.firstName }),
          `<p style="color: #D4A853; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${t('email.legal.actionRevokedMessage')}</p>
           <div style="background-color: rgba(16, 185, 129, 0.12); padding: 16px; border-radius: 8px; margin: 16px 0;">
             <p><strong>${ticket.subject}</strong></p>
           </div>`,
          t('email.common.supportMessage'),
          t,
          normalizedLang,
        ),
      );
    } catch (emailError) {
      this.logger.error('Failed to send revocation email:', emailError);
    }

    return {
      success: true,
      message: 'Action revoked successfully',
      action: updated,
    };
  }

  async deleteUserAdmin(userId: string) {
    try {
      await this.prisma.user.delete({ where: { id: userId } });
      return { success: true, message: 'User deleted' };
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async acceptLegalDocument(
    userId: string,
    documentType: 'terms' | 'privacy' | 'platform_rules' | 'cookies',
  ) {
    const updateData: any = {};

    switch (documentType) {
      case 'terms':
        updateData.termsAcceptedAt = new Date();
        break;
      case 'privacy':
        updateData.privacyAcceptedAt = new Date();
        break;
      case 'platform_rules':
        updateData.platformRulesAcceptedAt = new Date();
        break;
      case 'cookies':
        // No DB field for cookies acceptance yet; treat as acknowledged.
        break;
    }

    const user =
      documentType === 'cookies'
        ? await this.prisma.user.findUnique({ where: { id: userId } })
        : await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
          });

    return {
      success: true,
      documentType,
      acceptedAt:
        documentType === 'cookies'
          ? new Date()
          : updateData[`${documentType}AcceptedAt`] ||
            updateData.platformRulesAcceptedAt,
      user,
    };
  }

  async getLegalAcceptanceStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Type assertion needed until Prisma Client types are fully regenerated
    const userWithLegal = user as typeof user & {
      termsAcceptedAt: Date | null;
      privacyAcceptedAt: Date | null;
      platformRulesAcceptedAt: Date | null;
    };

    return {
      termsAccepted: !!userWithLegal.termsAcceptedAt,
      privacyAccepted: !!userWithLegal.privacyAcceptedAt,
      platformRulesAccepted: !!userWithLegal.platformRulesAcceptedAt,
      termsAcceptedAt: userWithLegal.termsAcceptedAt,
      privacyAcceptedAt: userWithLegal.privacyAcceptedAt,
      platformRulesAcceptedAt: userWithLegal.platformRulesAcceptedAt,
      allAccepted:
        !!userWithLegal.termsAcceptedAt &&
        !!userWithLegal.privacyAcceptedAt &&
        !!userWithLegal.platformRulesAcceptedAt,
    };
  }

  async updateMe(currentUserId: string, dto: UpdateMeDto, role?: string) {
    const data: Record<string, unknown> = {};

    // Admin users live in the admins collection
    if (role === 'ADMIN') {
      if (dto.email) {
        const prisma = this.prisma as unknown as {
          admin: {
            findUnique: (
              args: unknown,
            ) => Promise<{ id: string; email: string } | null>;
            update: (args: unknown) => Promise<unknown>;
          };
        };
        const exists = await prisma.admin.findUnique({
          where: { email: dto.email },
        });
        if (exists && exists.id !== currentUserId) {
          throw new ConflictException('Email already in use');
        }
        data.email = dto.email;
      }
      if (Object.keys(data).length === 0) {
        throw new BadRequestException('No fields to update');
      }
      const prisma = this.prisma as unknown as {
        admin: {
          update: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };
      const updated = await prisma.admin.update({
        where: { id: currentUserId },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          updatedAt: true,
        },
      });
      return { ...updated, role: 'ADMIN' };
    }

    if (dto.email) {
      // unique email check
      const exists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (exists && exists.id !== currentUserId) {
        throw new ConflictException('Email already in use');
      }
      data.email = dto.email;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
      // Reset phone verification when phone number changes
      const currentUser = await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select: { phone: true },
      });
      if (currentUser && currentUser.phone !== dto.phone) {
        data.phoneVerifiedAt = null;
      }
    }
    if (dto.language) data.language = dto.language;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: currentUserId },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true,
      },
    });
    return updated;
  }

  // User requests account deletion (GDPR)
  async requestDeletion(userId: string, dto: DeletionRequestDto) {
    // prevent duplicate pending requests
    const existing = await this.prisma.deletionRequest.findFirst({
      where: { userId, status: 'PENDING' },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'A pending deletion request already exists',
      );
    }
    const year = new Date().getFullYear();
    const prefix = `DEL-${year}-`;
    const lastDel = await this.prisma.deletionRequest.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    let seq = 1;
    if (lastDel?.ticketNumber) {
      const last = parseInt(lastDel.ticketNumber.replace(prefix, ''), 10);
      if (!isNaN(last)) seq = last + 1;
    }
    const ticketNumber = `${prefix}${seq.toString().padStart(6, '0')}`;

    const created = await this.prisma.deletionRequest.create({
      data: {
        userId,
        reason: dto.reason,
        ticketNumber,
        assignedCapability: 'DELETION_REQUEST_REVIEWER',
      },
      select: { id: true, status: true, createdAt: true, ticketNumber: true },
    });

    this.notifications.emitDeletionRequestCreated({
      userId,
      requestId: created.id,
      reason: dto.reason,
      ticketNumber,
    });
    return { request: created, message: 'Deletion request submitted' };
  }

  async cancelDeletionRequest(userId: string) {
    const pending = await this.prisma.deletionRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (!pending) {
      throw new BadRequestException('No pending deletion request found');
    }
    await this.prisma.deletionRequest.update({
      where: { id: pending.id },
      data: { status: 'DENIED', adminNotes: 'Cancelled by user' },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
    return { message: 'Deletion request cancelled. Your account is active.' };
  }

  // Admin list deletion requests
  async listDeletionRequestsScoped(
    adminId: string,
    isSuperAdmin: boolean,
    scope: 'all' | 'mine' | 'unassigned',
    status?: 'PENDING' | 'APPROVED' | 'DENIED',
  ) {
    // First, clean up orphaned deletion requests (userId references deleted users)
    const allRequests = await this.prisma.deletionRequest.findMany({
      select: { id: true, userId: true },
    });
    if (allRequests.length > 0) {
      const userIds = [...new Set(allRequests.map((r) => r.userId))];
      const existingUsers = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
      });
      const existingSet = new Set(existingUsers.map((u) => u.id));
      const orphanIds = allRequests
        .filter((r) => !existingSet.has(r.userId))
        .map((r) => r.id);
      if (orphanIds.length > 0) {
        await this.prisma.deletionRequest.deleteMany({
          where: { id: { in: orphanIds } },
        });
      }
    }

    const where: Prisma.DeletionRequestWhereInput = {};
    if (status) where.status = status;
    if (scope === 'mine') where.assignedTo = adminId;
    if (scope === 'unassigned') where.assignedTo = null;

    return this.prisma.deletionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        reason: true,
        createdAt: true,
        reviewedAt: true,
        adminNotes: true,
        assignedTo: true,
        assignedCapability: true,
        assignedAt: true,
        user: {
          select: {
            id: true,
            publicId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  // Admin review deletion request (approve/deny)
  async reviewDeletionRequest(
    adminId: string,
    requestId: string,
    decision: 'APPROVED' | 'DENIED',
    dto: AdminReviewDeletionDto,
  ) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, userId: true, ticketNumber: true },
    });
    if (!req) throw new NotFoundException('Deletion request not found');
    if (req.status !== 'PENDING')
      throw new BadRequestException('Request already reviewed');

    const updated = await this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        adminNotes: dto.notes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        reviewedAt: true,
        adminNotes: true,
      },
    });

    if (decision === 'APPROVED') {
      await this.prisma.user.update({
        where: { id: req.userId },
        data: { isActive: false },
      });
    } else if (decision === 'DENIED') {
      await this.prisma.user.update({
        where: { id: req.userId },
        data: { isActive: true },
      });
    }

    this.notifications.emitDeletionRequestReviewed({
      userId: req.userId,
      requestId: req.id,
      ticketNumber: req.ticketNumber,
      decision,
      adminNotes: dto.notes,
    });

    return { request: updated, message: 'Deletion request reviewed' };
  }

  async assignDeletionRequest(adminId: string, requestId: string) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, assignedTo: true },
    });
    if (!req) throw new NotFoundException('Deletion request not found');
    if (req.assignedTo && req.assignedTo !== adminId) {
      throw new BadRequestException('Request already assigned');
    }
    const updated = await this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: { assignedTo: adminId, assignedAt: new Date() },
      select: { id: true, assignedTo: true, assignedAt: true },
    });
    return { request: updated, message: 'Assigned to you' };
  }

  async unassignDeletionRequest(
    adminId: string,
    requestId: string,
    isSuperAdmin: boolean,
  ) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, assignedTo: true },
    });
    if (!req) throw new NotFoundException('Deletion request not found');
    if (req.assignedTo && req.assignedTo !== adminId && !isSuperAdmin) {
      throw new BadRequestException(
        "You cannot unassign another admin's request",
      );
    }
    const updated = await this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: { assignedTo: null, assignedAt: null },
      select: { id: true, assignedTo: true, assignedAt: true },
    });
    return { request: updated, message: 'Unassigned' };
  }

  async sendReferralInvite(userId: string, dto: SendReferralDto) {
    // Get the referrer's information
    const referrer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!referrer) {
      throw new NotFoundException('User not found');
    }

    // Only allow JOB_SEEKER (service providers) to send referrals
    if (referrer.role !== 'JOB_SEEKER') {
      throw new BadRequestException(
        'Only service providers can send referral invites',
      );
    }

    // Check if the friend's email is already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.friendEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email address is already registered',
      );
    }

    // Generate signup link
    const clientBaseUrl =
      this.config.get<string>('CLIENT_BASE_URL') || 'http://localhost:3002';
    const signupLink = `${clientBaseUrl}/register?ref=${referrer.id}`;

    // Send referral email
    const referrerName =
      `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() ||
      referrer.email;
    const emailSent = await this.notifications.sendReferralEmail(
      dto.friendEmail,
      dto.friendName,
      referrerName,
      referrer.email,
      signupLink,
      referrer.id,
    );

    if (!emailSent) {
      throw new BadRequestException('Failed to send referral email');
    }

    return {
      success: true,
      message: 'Referral invite sent successfully',
      friendEmail: dto.friendEmail,
    };
  }

  async referCandidateToJob(
    employerId: string,
    candidateId: string,
    dto: ReferToJobDto,
  ) {
    // Verify employer exists and is an employer
    const employer = await this.prisma.user.findUnique({
      where: { id: employerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    if (!employer) {
      throw new NotFoundException('Employer not found');
    }

    if (employer.role !== 'EMPLOYER') {
      throw new BadRequestException(
        'Only employers can refer candidates to jobs',
      );
    }

    // Verify candidate exists
    const candidate = await this.prisma.user.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.role !== 'JOB_SEEKER') {
      throw new BadRequestException('Can only refer job seekers to jobs');
    }

    // Verify job exists and belongs to employer
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: {
        id: true,
        title: true,
        description: true,
        employerId: true,
        location: true,
        city: true,
        country: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        rateAmount: true,
        currency: true,
        paymentType: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only refer candidates to your own jobs',
      );
    }

    // Check if candidate has already applied to this job
    const existingApplication = await this.prisma.application.findFirst({
      where: {
        applicantId: candidateId,
        jobId: dto.jobId,
        status: {
          not: 'WITHDRAWN',
        },
      },
      select: { id: true },
    });

    if (existingApplication) {
      throw new ConflictException('Candidate has already applied to this job');
    }

    // Check if candidate has already been referred to this job
    const existingReferral = await this.prisma.jobReferral.findUnique({
      where: {
        employerId_candidateId_jobId: {
          employerId: employerId,
          candidateId: candidateId,
          jobId: dto.jobId,
        },
      },
      select: { id: true, applicationId: true },
    });

    if (existingReferral) {
      throw new ConflictException(
        'Candidate has already been referred to this job',
      );
    }

    // Create referral and application in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the referral
      const referral = await tx.jobReferral.create({
        data: {
          employerId,
          candidateId,
          jobId: dto.jobId,
        },
      });

      // Create an application for this referral (status PENDING)
      const application = await tx.application.create({
        data: {
          applicantId: candidateId,
          jobId: dto.jobId,
          status: 'PENDING',
        },
      });

      // Link the application to the referral
      await tx.jobReferral.update({
        where: { id: referral.id },
        data: { applicationId: application.id },
      });

      return { referral, application };
    });

    // Send referral email
    const employerName =
      `${employer.firstName || ''} ${employer.lastName || ''}`.trim() ||
      employer.email;
    const candidateName =
      `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
      candidate.email;

    const emailSent = await this.notifications.sendJobReferralEmail(
      candidate.email,
      candidateName,
      employerName,
      employer.email,
      job,
      candidate.id,
    );

    return {
      success: true,
      message: 'Candidate referred to job successfully',
      emailSent,
      referralId: result.referral.id,
      applicationId: result.application.id,
    };
  }
}
