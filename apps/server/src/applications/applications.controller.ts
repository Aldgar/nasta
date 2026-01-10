import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Post,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ApplicationsService } from './applications.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateApplicationStatusDto } from './dto/update-status.dto';
import { WithdrawApplicationDto } from './dto/withdraw-application.dto';
import { RequestAdditionalRatesDto } from './dto/request-additional-rates.dto';
import { RespondAdditionalRatesDto } from './dto/respond-additional-rates.dto';
import { UpdateSelectedRatesDto } from './dto/update-selected-rates.dto';
import { SuggestNegotiationDto } from './dto/suggest-negotiation.dto';
import { RespondNegotiationDto } from './dto/respond-negotiation.dto';
import { CounterOfferNegotiationDto } from './dto/counter-offer-negotiation.dto';
import { RespondCounterOfferDto } from './dto/respond-counter-offer.dto';
import { RequestAdditionalTimeDto } from './dto/request-additional-time.dto';
import { RespondAdditionalTimeDto } from './dto/respond-additional-time.dto';
import { RespondAdditionalTimeResponseDto } from './dto/respond-additional-time-response.dto';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // Seeker: list my applications
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my applications (job seeker)' })
  async myApplications(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status')
    status?:
      | 'PENDING'
      | 'REVIEWING'
      | 'SHORTLISTED'
      | 'ACCEPTED'
      | 'REJECTED'
      | 'WITHDRAWN',
  ) {
    const user = req.user as { id: string };
    return this.service.listMyApplications(user.id, {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      status,
    });
  }

  // Employer: list applications for my jobs
  @Get('/employer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List applications for my jobs (employer)' })
  async employerApplications(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status')
    status?:
      | 'PENDING'
      | 'REVIEWING'
      | 'SHORTLISTED'
      | 'ACCEPTED'
      | 'REJECTED'
      | 'WITHDRAWN',
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException('Only employers can access this endpoint');
    }
    return this.service.listEmployerApplications(user.id, {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      status,
    });
  }

  // Get application detail (role-based visibility)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get application detail (seeker/employer/admin)' })
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    return this.service.getApplicationForUser(user.id, user.role, id);
  }

  // Employer: update an application status
  @Post(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application status (employer)' })
  @ApiBody({ type: UpdateApplicationStatusDto })
  async setStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException('Only employers can update status');
    }
    return this.service.updateStatusAsEmployer(
      user.id,
      id,
      dto.status as
        | 'PENDING'
        | 'REVIEWING'
        | 'SHORTLISTED'
        | 'ACCEPTED'
        | 'REJECTED'
        | 'WITHDRAWN',
      dto.message,
    );
  }

  // Service provider: request additional rates
  @Post(':id/additional-rates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request additional rates (service provider)' })
  @ApiBody({ type: RequestAdditionalRatesDto })
  async requestAdditionalRates(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RequestAdditionalRatesDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can request additional rates',
      );
    }
    return this.service.requestAdditionalRates(
      user.id,
      id,
      dto.rates,
      dto.totalAmount,
      dto.message,
    );
  }

  // Employer: respond to additional rates request
  @Post(':id/additional-rates/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to additional rates request (employer)' })
  @ApiBody({ type: RespondAdditionalRatesDto })
  async respondToAdditionalRates(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondAdditionalRatesDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException(
        'Only employers can respond to additional rates requests',
      );
    }
    return (await this.service.respondToAdditionalRates(
      user.id,
      id,
      dto.requestId,
      dto.status,
      dto.message,
    )) as unknown;
  }

  // Employer: update selected rates for an application
  @Post(':id/selected-rates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update selected rates for an application (employer)',
  })
  @ApiBody({ type: UpdateSelectedRatesDto })
  async updateSelectedRates(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateSelectedRatesDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException('Only employers can update selected rates');
    }
    return this.service.updateSelectedRates(user.id, id, dto.selectedRates);
  }

  // Employer: suggest negotiation rates for an application
  @Post(':id/negotiation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Suggest negotiation rates for an application (employer)',
  })
  @ApiBody({ type: SuggestNegotiationDto })
  async suggestNegotiation(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SuggestNegotiationDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException('Only employers can suggest negotiations');
    }
    return this.service.suggestNegotiation(
      user.id,
      id,
      dto.rates,
      dto.totalAmount,
      dto.message,
    );
  }

  // Service provider: request negotiation rates for an application
  @Post(':id/negotiation/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request negotiation rates for an application (service provider)',
  })
  @ApiBody({ type: SuggestNegotiationDto })
  async requestNegotiation(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SuggestNegotiationDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can request negotiations',
      );
    }
    return await this.service.requestNegotiation(
      user.id,
      id,
      dto.rates,
      dto.totalAmount,
      dto.message,
    );
  }

  // Service provider: respond to negotiation suggestion
  @Post(':id/negotiation/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Respond to negotiation suggestion (service provider)',
  })
  @ApiBody({ type: RespondNegotiationDto })
  async respondToNegotiation(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondNegotiationDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can respond to negotiations',
      );
    }
    return (await this.service.respondToNegotiation(
      user.id,
      id,
      dto.requestId,
      dto.status,
      dto.message,
    )) as unknown;
  }

  // Employer: respond to negotiation requested by service provider
  @Post(':id/negotiation/respond-employer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to negotiation request (employer)' })
  @ApiBody({ type: RespondNegotiationDto })
  async respondToNegotiationAsEmployer(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondNegotiationDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException(
        'Only employers can respond to negotiations',
      );
    }
    return await this.service.respondToNegotiationAsEmployer(
      user.id,
      id,
      dto.requestId,
      dto.status,
      dto.message,
    );
  }

  // Service provider: send counter offer to negotiation
  @Post(':id/negotiation/counter-offer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send counter offer to negotiation (service provider)',
  })
  @ApiBody({ type: CounterOfferNegotiationDto })
  async counterOfferNegotiation(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CounterOfferNegotiationDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can send counter offers',
      );
    }
    return this.service.counterOfferNegotiation(
      user.id,
      id,
      dto.requestId,
      dto.rates,
      dto.totalAmount,
      dto.message,
    );
  }

  // Employer: send counter offer to service provider negotiation request
  @Post(':id/negotiation/counter-offer-employer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send counter offer to negotiation request (employer)',
  })
  @ApiBody({ type: CounterOfferNegotiationDto })
  async counterOfferNegotiationAsEmployer(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CounterOfferNegotiationDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException(
        'Only employers can send counter offers to service provider requests',
      );
    }
    return this.service.counterOfferNegotiationAsEmployer(
      user.id,
      id,
      dto.requestId,
      dto.rates,
      dto.totalAmount,
      dto.message,
    );
  }

  // Service provider: respond to employer counter offer
  @Post(':id/negotiation/counter-offer/respond-service-provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to counter offer (service provider)' })
  @ApiBody({ type: RespondCounterOfferDto })
  async respondToCounterOfferAsServiceProvider(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondCounterOfferDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can respond to employer counter offers',
      );
    }
    return this.service.respondToCounterOfferAsServiceProvider(
      user.id,
      id,
      dto.requestId,
      dto.counterOfferId,
      dto.status,
      dto.message,
    );
  }

  // Employer: respond to counter offer
  @Post(':id/negotiation/counter-offer/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to counter offer (employer)' })
  @ApiBody({ type: RespondCounterOfferDto })
  async respondToCounterOffer(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondCounterOfferDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException(
        'Only employers can respond to counter offers',
      );
    }
    return this.service.respondToCounterOffer(
      user.id,
      id,
      dto.requestId,
      dto.counterOfferId,
      dto.status,
      dto.message,
    );
  }

  // Employer: request additional time from service provider
  @Post(':id/additional-time/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request additional time (employer)' })
  @ApiBody({ type: RequestAdditionalTimeDto })
  async requestAdditionalTime(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RequestAdditionalTimeDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException(
        'Only employers can request additional time',
      );
    }
    return this.service.requestAdditionalTime(user.id, id, dto.message);
  }

  // Service provider: respond to employer's additional time request
  @Post(':id/additional-time/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to additional time request (service provider)' })
  @ApiBody({ type: RespondAdditionalTimeDto })
  async respondToAdditionalTimeRequest(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondAdditionalTimeDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can respond to additional time requests',
      );
    }
    return this.service.respondToAdditionalTimeRequest(
      user.id,
      id,
      dto.requestId,
      dto.additionalDays,
      dto.explanation,
    );
  }

  // Employer: accept or reject service provider's additional time response
  @Post(':id/additional-time/respond-employer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to additional time response (employer)' })
  @ApiBody({ type: RespondAdditionalTimeResponseDto })
  async respondToAdditionalTimeResponse(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RespondAdditionalTimeResponseDto,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException(
        'Only employers can respond to additional time responses',
      );
    }
    return this.service.respondToAdditionalTimeResponse(
      user.id,
      id,
      dto.requestId,
      dto.status,
      dto.message,
    );
  }

  // Service provider: verify service code to start the service
  @Post(':id/verify-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify service code to start the service (service provider)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: '4-digit verification code',
          example: '1234',
        },
      },
      required: ['code'],
    },
  })
  async verifyServiceCode(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { code: string },
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can verify service codes',
      );
    }
    return this.service.verifyServiceCode(user.id, id, dto.code);
  }

  // Service provider: mark job as done
  @Post(':id/mark-done')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark job as done (service provider)' })
  async markJobAsDoneByServiceProvider(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'JOB_SEEKER') {
      throw new ForbiddenException(
        'Only service providers can mark jobs as done',
      );
    }
    return this.service.markJobAsDoneByServiceProvider(user.id, id);
  }

  // Employer: create application for candidate (instant jobs)
  @Post('instant/:jobId/:candidateId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create application for candidate (employer - instant jobs)',
  })
  async createApplicationForCandidate(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Param('candidateId') candidateId: string,
  ) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only employers can create applications for candidates',
      );
    }
    return this.service.createApplicationForCandidate(
      user.id,
      jobId,
      candidateId,
    );
  }

  // Employer: delete instant job request
  @Post(':id/delete-instant')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete instant job request (employer - before acceptance)',
  })
  async deleteInstantJobRequest(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as {
      id: string;
      role?: 'EMPLOYER' | 'JOB_SEEKER' | 'ADMIN';
    };
    if (user.role !== 'EMPLOYER' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only employers can delete instant job requests',
      );
    }
    return this.service.deleteInstantJobRequest(user.id, id);
  }
}

@ApiTags('admin-applications')
@Controller('admin/applications')
@Public()
@UseGuards(AdminJwtGuard)
export class AdminApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all applications (admin)' })
  async listAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status')
    status?:
      | 'PENDING'
      | 'REVIEWING'
      | 'SHORTLISTED'
      | 'ACCEPTED'
      | 'REJECTED'
      | 'WITHDRAWN',
  ) {
    return this.service.listAllApplications({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      status,
    });
  }

  @Post(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application status (admin)' })
  @ApiBody({ type: UpdateApplicationStatusDto })
  async setStatusAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.service.updateStatusAsAdmin(
      id,
      dto.status as
        | 'PENDING'
        | 'REVIEWING'
        | 'SHORTLISTED'
        | 'ACCEPTED'
        | 'REJECTED'
        | 'WITHDRAWN',
      dto.message,
    );
  }
}

@ApiTags('applications')
@Controller('applications')
export class SeekerApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // Seeker: withdraw own application
  @Post(':id/withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Withdraw my application (job seeker)' })
  @ApiBody({ type: WithdrawApplicationDto })
  async withdraw(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: WithdrawApplicationDto,
  ) {
    const user = req.user as { id: string };
    return this.service.withdrawAsSeeker(user.id, id, dto.reason);
  }
}
