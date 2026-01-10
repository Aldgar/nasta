import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request {
  user?: {
    userId?: string;
    id?: string;
  };
}

@ApiTags('Ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('applications/:applicationId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user needs to rate a completed job' })
  async checkRatingStatus(
    @Param('applicationId') applicationId: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.ratingsService.checkRatingStatus(applicationId, userId);
  }

  @Post('applications/:applicationId/employer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit employer rating for completed job' })
  async submitEmployerRating(
    @Param('applicationId') applicationId: string,
    @Req() req: RequestWithUser,
    @Body()
    body: {
      platformRating: number;
      easeOfServiceRating: number;
      serviceProviderRating: number;
      platformComment?: string;
      easeOfServiceComment?: string;
      serviceProviderComment?: string;
    },
  ) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    return this.ratingsService.submitEmployerRating(
      applicationId,
      employerId,
      body,
    );
  }

  @Post('applications/:applicationId/service-provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit service provider rating for completed job' })
  async submitServiceProviderRating(
    @Param('applicationId') applicationId: string,
    @Req() req: RequestWithUser,
    @Body()
    body: {
      platformRating: number;
      employerRating: number;
      platformComment?: string;
      employerComment?: string;
    },
  ) {
    const serviceProviderId = String(req.user?.userId ?? req.user?.id);
    return this.ratingsService.submitServiceProviderRating(
      applicationId,
      serviceProviderId,
      body,
    );
  }

  @Post('applications/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get rating status for multiple applications' })
  async getRatingStatusForApplications(
    @Req() req: RequestWithUser,
    @Body() body: { applicationIds: string[] },
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.ratingsService.getRatingStatusForApplications(
      body.applicationIds,
      userId,
    );
  }
}

