import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(reviewerId: string, dto: CreateReviewDto) {
    const { targetUserId, rating, comment } = dto;

    // Prevent self-review
    if (reviewerId === targetUserId) {
      throw new BadRequestException('You cannot review yourself');
    }

    // Check if target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if reviewer exists
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
    });

    if (!reviewer) {
      throw new NotFoundException('Reviewer not found');
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        reviewerId,
        revieweeId: targetUserId,
        rating,
        comment: comment || null,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return review;
  }
}

