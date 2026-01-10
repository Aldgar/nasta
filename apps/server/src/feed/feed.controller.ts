import {
  Body,
  Controller,
  Get,
  Delete,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeedService } from './feed.service';
import { CreateFeedPostDto } from './dto/create-feed-post.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('feed')
@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly service: FeedService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List newsfeed posts for current user' })
  async list(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('cursor') cursor?: string,
  ) {
    const user = req.user as {
      id: string;
      role?: 'ADMIN' | 'EMPLOYER' | 'JOB_SEEKER';
    };
    const lim = Math.min(Number(limit) || 20, 100);
    if (cursor) {
      return this.service.listForUserCursor(user.id, user.role, {
        cursor,
        limit: lim,
      });
    }
    return this.service.listForUser(user.id, user.role, {
      page: Number(page) || 1,
      limit: lim,
    });
  }

  // Employer: post an update for a job they own
  @Post('job/:jobId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a job-related post (employer)' })
  @ApiBody({ type: CreateFeedPostDto })
  async createJobPost(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Body() dto: CreateFeedPostDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'ADMIN' | 'EMPLOYER' | 'JOB_SEEKER';
    };
    // Basic role check here (detailed ownership check in service)
    if (user.role !== 'EMPLOYER') {
      // Throwing forbidden here keeps it simple
      throw new (await import('@nestjs/common')).ForbiddenException(
        'Only employers can post for jobs',
      );
    }
    return this.service.createEmployerJobPost(user.id, jobId, dto);
  }

  // Reactions: acknowledge
  @Post(':postId/ack')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Acknowledge a post' })
  async acknowledge(@Req() req: Request, @Param('postId') postId: string) {
    const user = req.user as { id: string };
    return this.service.acknowledge(postId, user.id);
  }

  @Delete(':postId/ack')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove acknowledge from a post' })
  async unacknowledge(@Req() req: Request, @Param('postId') postId: string) {
    const user = req.user as { id: string };
    return this.service.unacknowledge(postId, user.id);
  }
}
