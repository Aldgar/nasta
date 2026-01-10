import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user needs to rate a completed job
   */
  async checkRatingStatus(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            employerId: true,
            status: true,
          },
        },
        applicant: {
          select: {
            id: true,
          },
        },
        completionRatings: {
          where: {
            raterId: userId,
          },
          select: {
            id: true,
            platformRating: true,
            easeOfServiceRating: true,
            otherPartyRating: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if job is completed
    if (application.job.status !== 'COMPLETED' && !application.completedAt) {
      return {
        needsRating: false,
        reason: 'Job is not completed yet',
      };
    }

    const isEmployer = application.job.employerId === userId;
    const isServiceProvider = application.applicantId === userId;

    if (!isEmployer && !isServiceProvider) {
      throw new ForbiddenException('You are not authorized to rate this job');
    }

    const existingRating = application.completionRatings[0];

    return {
      needsRating: !existingRating,
      hasRated: !!existingRating,
      rating: existingRating || null,
      isEmployer,
      isServiceProvider,
    };
  }

  /**
   * Submit employer rating for completed job
   */
  async submitEmployerRating(
    applicationId: string,
    employerId: string,
    data: {
      platformRating: number;
      easeOfServiceRating: number;
      serviceProviderRating: number;
      platformComment?: string;
      easeOfServiceComment?: string;
      serviceProviderComment?: string;
    },
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            employerId: true,
            status: true,
          },
        },
        completionRatings: {
          where: {
            raterId: employerId,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.job.employerId !== employerId) {
      throw new ForbiddenException('You can only rate your own jobs');
    }

    if (application.job.status !== 'COMPLETED' && !application.completedAt) {
      throw new BadRequestException('Job must be completed before rating');
    }

    // Validate ratings (1-5)
    if (
      data.platformRating < 1 ||
      data.platformRating > 5 ||
      data.easeOfServiceRating < 1 ||
      data.easeOfServiceRating > 5 ||
      data.serviceProviderRating < 1 ||
      data.serviceProviderRating > 5
    ) {
      throw new BadRequestException('Ratings must be between 1 and 5');
    }

    // Check if already rated
    if (application.completionRatings.length > 0) {
      throw new BadRequestException('You have already rated this job');
    }

    // Create rating
    const rating = await this.prisma.jobCompletionRating.create({
      data: {
        applicationId,
        raterId: employerId,
        platformRating: data.platformRating,
        easeOfServiceRating: data.easeOfServiceRating,
        otherPartyRating: data.serviceProviderRating,
        platformComment: data.platformComment,
        easeOfServiceComment: data.easeOfServiceComment,
        otherPartyComment: data.serviceProviderComment,
      },
    });

    return rating;
  }

  /**
   * Submit service provider rating for completed job
   */
  async submitServiceProviderRating(
    applicationId: string,
    serviceProviderId: string,
    data: {
      platformRating: number;
      employerRating: number;
      platformComment?: string;
      employerComment?: string;
    },
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            status: true,
          },
        },
        applicant: {
          select: {
            id: true,
          },
        },
        completionRatings: {
          where: {
            raterId: serviceProviderId,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.applicantId !== serviceProviderId) {
      throw new ForbiddenException('You can only rate jobs you completed');
    }

    if (application.job.status !== 'COMPLETED' && !application.completedAt) {
      throw new BadRequestException('Job must be completed before rating');
    }

    // Validate ratings (1-5)
    if (
      data.platformRating < 1 ||
      data.platformRating > 5 ||
      data.employerRating < 1 ||
      data.employerRating > 5
    ) {
      throw new BadRequestException('Ratings must be between 1 and 5');
    }

    // Check if already rated
    if (application.completionRatings.length > 0) {
      throw new BadRequestException('You have already rated this job');
    }

    // Create rating
    const rating = await this.prisma.jobCompletionRating.create({
      data: {
        applicationId,
        raterId: serviceProviderId,
        platformRating: data.platformRating,
        easeOfServiceRating: null, // Not applicable for service providers
        otherPartyRating: data.employerRating,
        platformComment: data.platformComment,
        easeOfServiceComment: null,
        otherPartyComment: data.employerComment,
      },
    });

    return rating;
  }

  /**
   * Get rating status for multiple applications (for checking which jobs need rating)
   */
  async getRatingStatusForApplications(applicationIds: string[], userId: string) {
    const ratings = await this.prisma.jobCompletionRating.findMany({
      where: {
        applicationId: { in: applicationIds },
        raterId: userId,
      },
      select: {
        applicationId: true,
      },
    });

    const ratedApplicationIds = new Set(ratings.map((r) => r.applicationId));

    return applicationIds.map((id) => ({
      applicationId: id,
      needsRating: !ratedApplicationIds.has(id),
    }));
  }
}

