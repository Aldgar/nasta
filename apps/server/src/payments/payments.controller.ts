import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { ApiOperation, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthorizeHoldDto } from './dto/authorize-hold.dto';
import { CaptureBookingDto } from './dto/capture-booking.dto';
import { CreateAccountLinkDto } from './dto/create-account-link.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { CreateApplicationPaymentDto } from './dto/create-application-payment.dto';

interface RequestWithUser extends Request {
  user?: { id?: string; userId?: string };
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('config')
  @Public()
  getPaymentConfig() {
    return {
      publishableKey: this.config.get<string>('STRIPE_PUBLISHABLE_KEY') || '',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout/session')
  async createCheckoutSession(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const session = await this.payments.createCheckoutSession({
      userId,
      priceId: dto.priceId,
      amount: dto.amount,
      currency: dto.currency,
      quantity: dto.quantity,
      mode: dto.mode,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      metadata: { ...dto.metadata, jobId: dto.jobId ?? '' },
    });
    return { id: session.id, url: session.url };
  }

  @UseGuards(JwtAuthGuard)
  @Post('intent')
  async createPaymentIntent(
    @Req() req: RequestWithUser,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const result = await this.payments.createPaymentIntent({
      userId,
      amount: dto.amount,
      currency: dto.currency,
      metadata: dto.metadata,
    });
    return {
      id: result.paymentIntent.id,
      clientSecret: result.paymentIntent.client_secret,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup-intent')
  async createSetupIntent(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.createSetupIntent(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payment-methods')
  async listPaymentMethods(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.listPaymentMethods(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('payment-methods/:paymentMethodId')
  async deletePaymentMethod(
    @Req() req: RequestWithUser,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.deletePaymentMethod(userId, paymentMethodId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('payment-methods/:paymentMethodId/set-default')
  async setDefaultPaymentMethod(
    @Req() req: RequestWithUser,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.setDefaultPaymentMethod(userId, paymentMethodId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('connect/status')
  async getConnectStatus(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    // Get client IP for TOS acceptance if needed
    const clientIp =
      req.ip ||
      req.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      '0.0.0.0';
    return this.payments.getConnectAccountStatus(userId, clientIp);
  }

  // This route must receive the raw body; middleware is applied in main.ts
  @Post('webhook')
  async webhook(
    @Req() req: Request & { body: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    try {
      return await this.payments.handleWebhook(req.body as Buffer, signature);
    } catch (error: any) {
      const logger = new (require('@nestjs/common').Logger)(
        'PaymentsController',
      );
      logger.error(
        `❌ Webhook processing failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Backwards-compatible alias (some environments configured this path)
  @Post('webhooks/stripe')
  async webhookStripeAlias(
    @Req() req: Request & { body: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.payments.handleWebhook(req.body as Buffer, signature);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listMyPayments(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.listPaymentsForUser(userId);
  }

  // Dashboards
  @UseGuards(JwtAuthGuard)
  @Get('dashboard/job-seeker')
  async jobSeekerDashboard(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);

    const data: unknown = await this.payments.getJobSeekerDashboard(userId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data as any;
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard/employer')
  async employerDashboard(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);

    const data: unknown = await this.payments.getEmployerDashboard(userId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data as any;
  }

  // Booking manual-capture flow
  @UseGuards(JwtAuthGuard)
  @Post('bookings/:bookingId/authorize')
  async authorizeHold(
    @Req() req: RequestWithUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: AuthorizeHoldDto,
  ) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    const { clientSecret, paymentIntentId } =
      await this.payments.authorizeBookingHold(employerId, bookingId, dto);
    return { paymentIntentId, clientSecret };
  }

  // Stripe Connect onboarding
  @UseGuards(JwtAuthGuard)
  @Post('connect/account')
  async createConnectAccount(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    // Get client IP for TOS acceptance
    const clientIp =
      req.ip ||
      req.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      '0.0.0.0';
    const { accountId } = await this.payments.ensureConnectAccount(
      userId,
      clientIp,
    );
    return { accountId };
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect/account-link')
  async createConnectAccountLink(
    @Req() req: RequestWithUser,
    @Body() dto: CreateAccountLinkDto,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const link = await this.payments.createAccountOnboardingLink(userId, {
      refreshUrl: dto.refreshUrl,
      returnUrl: dto.returnUrl,
      state: dto.state,
    });
    return link;
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect/bank-account')
  async updateBankAccount(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateBankAccountDto,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    // Get client IP for TOS acceptance
    const clientIp =
      req.ip ||
      req.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      '0.0.0.0';
    console.log('[PaymentsController] Received bank account update:', {
      userId,
      country: dto.country,
      countryType: typeof dto.country,
      countryLength: dto.country?.length,
      iban: dto.iban ? `${dto.iban.substring(0, 4)}...` : undefined,
    });
    return this.payments.updateBankAccount(userId, dto, clientIp);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('connect/bank-account/:bankAccountId')
  async deleteBankAccount(
    @Req() req: RequestWithUser,
    @Param('bankAccountId') bankAccountId: string,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.deleteBankAccount(userId, bankAccountId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect/bank-account/:bankAccountId/set-default')
  async setDefaultBankAccount(
    @Req() req: RequestWithUser,
    @Param('bankAccountId') bankAccountId: string,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.setDefaultBankAccount(userId, bankAccountId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings/:bookingId/capture')
  async captureBooking(
    @Req() req: RequestWithUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: CaptureBookingDto,
  ) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    const result = await this.payments.captureBookingPayment(
      employerId,
      bookingId,
      dto,
    );
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @UseGuards(JwtAuthGuard)
  @Post('applications/:applicationId/payment')
  @ApiOperation({ summary: 'Create payment intent for application' })
  @ApiBody({ type: CreateApplicationPaymentDto })
  async createApplicationPayment(
    @Req() req: RequestWithUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateApplicationPaymentDto,
  ) {
    const employerId = String(req.user?.userId ?? req.user?.id);

    // Get application and job details
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            employerId: true,
            currency: true,
          },
        },
      },
    });

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    if (application.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only pay for your own job applications',
      );
    }

    // Ensure the server has the latest selected rates before we validate payment amounts.
    // If the client is initiating payment from a flow that hasn't persisted selection yet,
    // `checkApplicationPayment` would otherwise compute a required total of 0 and incorrectly
    // block the payment as "already paid".
    if (dto.selectedRates && dto.selectedRates.length > 0) {
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          selectedRates: dto.selectedRates as any,
        },
      });
    }

    // Get payment status to determine what was already paid and what is unpaid
    const paymentStatus =
      await this.payments.checkApplicationPayment(applicationId);

    // If payment is not required (no payment record exists), allow the payment to proceed
    // This is the first payment for this application
    if (!paymentStatus.paymentRequired) {
      // Allow payment to proceed - this is the initial payment
      // Validation will happen in createApplicationPayment service
    } else {
      // Payment record exists - validate the amount to charge.
      // Prefer the server-calculated unpaid amount; if it is missing/zero but we have
      // a non-zero scope total (e.g., selection was just persisted), validate against scope.
      const expectedUnpaidAmount = paymentStatus.unpaidAmount || 0;

      // Check if there are unpaid services or negotiations (more reliable than just amount)
      const hasUnpaidServices = (paymentStatus.unpaidServices?.length || 0) > 0;
      const hasUnpaidNegotiations =
        (paymentStatus.unpaidNegotiations?.length || 0) > 0;
      const hasUnpaidItems = hasUnpaidServices || hasUnpaidNegotiations;

      // Compute the required total for the *current scope* (selected services + accepted negotiations).
      // This is used as a fallback when the unpaid amount isn't available yet.
      const negotiationRequests =
        (application.negotiationRequests as any) || [];
      const acceptedNegotiations = Array.isArray(negotiationRequests)
        ? negotiationRequests.filter((req: any) => req.status === 'ACCEPTED')
        : [];

      const selectedRates = Array.isArray(dto.selectedRates)
        ? dto.selectedRates
        : [];
      const totalServicesAmount = selectedRates.reduce(
        (sum, s) => sum + (s?.rate || 0),
        0,
      );
      const totalNegotiationsAmount = acceptedNegotiations.reduce(
        (sum: number, neg: any) => {
          const negAmount =
            neg?.counterOffer?.status === 'ACCEPTED'
              ? neg.counterOffer.totalAmount || 0
              : neg.totalAmount || 0;
          return sum + (negAmount || 0);
        },
        0,
      );
      const expectedScopeTotal =
        Math.round((totalServicesAmount + totalNegotiationsAmount) * 100) / 100;

      const expectedAmountToCharge =
        expectedUnpaidAmount > 0.01 ? expectedUnpaidAmount : expectedScopeTotal;

      // If Stripe says payment is completed and nothing is due for the current scope, reject.
      if (
        paymentStatus.paymentCompleted &&
        expectedAmountToCharge <= 0.01 &&
        !hasUnpaidItems &&
        dto.totalAmount > 0.01
      ) {
        throw new BadRequestException(
          'No additional payment is needed. All services and negotiations have already been paid for.',
        );
      }

      // Validate the amount (allow small rounding differences)
      if (expectedAmountToCharge > 0.01 || hasUnpaidItems) {
        const amountDifference = Math.abs(
          expectedAmountToCharge - dto.totalAmount,
        );
        if (amountDifference > 0.02) {
          throw new BadRequestException(
            `Payment amount does not match what is due. Expected: ${expectedAmountToCharge.toFixed(2)}, Received: ${dto.totalAmount.toFixed(2)}. Unpaid services: ${hasUnpaidServices}, Unpaid negotiations: ${hasUnpaidNegotiations}`,
          );
        }
      }
    }

    // Validate that we have at least one payment source (selected rates, negotiations, or additional rates)
    const hasSelectedRates = dto.selectedRates && dto.selectedRates.length > 0;
    const negotiationRequests = (application.negotiationRequests as any) || [];
    const additionalRateRequests =
      (application.additionalRateRequests as any) || [];
    const hasNegotiations = negotiationRequests.some(
      (req: any) => req.status === 'ACCEPTED',
    );
    const hasAdditionalRates = additionalRateRequests.some(
      (req: any) => req.status === 'APPROVED',
    );

    if (
      !hasSelectedRates &&
      !hasNegotiations &&
      !hasAdditionalRates &&
      dto.totalAmount > 0.01
    ) {
      throw new BadRequestException(
        'Please select at least one service, approve additional rate requests, or have an accepted negotiation before proceeding with payment',
      );
    }

    // Convert total amount to cents (assuming rates are in euros/dollars)
    const amountInCents = Math.round(dto.totalAmount * 100);

    // Log payment creation details
    console.log('[PaymentsController] Creating payment:', {
      applicationId,
      paymentRequired: paymentStatus.paymentRequired,
      paymentCompleted: paymentStatus.paymentCompleted,
      selectedRatesCount: dto.selectedRates?.length || 0,
      selectedRates: dto.selectedRates,
      totalAmount: dto.totalAmount,
      expectedUnpaidAmount: paymentStatus.unpaidAmount || 0,
      paidAmount: paymentStatus.paidAmount || 0,
      unpaidAmount: paymentStatus.unpaidAmount || 0,
      unpaidServices: paymentStatus.unpaidServices?.length || 0,
      unpaidNegotiations: paymentStatus.unpaidNegotiations?.length || 0,
      amountInCents,
      currency: application.job.currency || 'eur',
    });

    const result = await this.payments.createApplicationPayment({
      employerId,
      applicationId,
      amount: amountInCents,
      currency: application.job.currency || 'eur',
      selectedRates: dto.selectedRates,
    });

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications/:applicationId/payment-status')
  @ApiOperation({ summary: 'Check payment status for application' })
  async getApplicationPaymentStatus(
    @Req() req: RequestWithUser,
    @Param('applicationId') applicationId: string,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);

    // Verify user has access to this application
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: { employerId: true },
        },
      },
    });

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    if (application.job.employerId !== userId) {
      throw new ForbiddenException(
        'You can only check payment status for your own applications',
      );
    }

    return this.payments.checkApplicationPayment(applicationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applications/:applicationId/complete')
  @ApiOperation({ summary: 'Mark application as complete and capture payment' })
  async completeApplication(
    @Req() req: RequestWithUser,
    @Param('applicationId') applicationId: string,
  ) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    return this.payments.completeApplicationPayment(employerId, applicationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applications/:applicationId/sync-booking')
  @ApiOperation({
    summary: 'Sync booking for a completed application (admin/employer)',
  })
  async syncBooking(
    @Req() req: RequestWithUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.payments.syncBookingForCompletedApplication(applicationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applications/sync-all-bookings')
  @ApiOperation({
    summary: 'Sync all completed applications with bookings (admin only)',
  })
  async syncAllBookings(@Req() req: RequestWithUser) {
    const user = req.user as { role?: string };
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can sync all bookings');
    }
    return this.payments.syncAllCompletedApplicationsBookings();
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings/sync-my-bookings')
  @ApiOperation({
    summary: 'Sync my bookings with completed applications (service provider)',
  })
  async syncMyBookings(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.syncBookingsForServiceProvider(userId);
  }

  @Post('bookings/:bookingId/cancel')
  async cancelHold(
    @Req() req: RequestWithUser,
    @Param('bookingId') bookingId: string,
  ) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    return this.payments.cancelBookingHold(employerId, bookingId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  @Post('bookings/:bookingId/sync-payout')
  @ApiOperation({
    summary: 'Sync payout status for a specific booking from Stripe',
  })
  async syncBookingPayout(
    @Req() req: RequestWithUser,
    @Param('bookingId') bookingId: string,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    // Verify booking belongs to user
    const booking = await this.payments['prisma'].booking.findUnique({
      where: { id: bookingId },
      select: { jobSeekerId: true },
    });

    if (!booking || booking.jobSeekerId !== userId) {
      throw new ForbiddenException('Booking not found or access denied');
    }

    return this.payments.syncBookingPayoutStatus(bookingId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  @Post('sync-my-payouts')
  @ApiOperation({
    summary: 'Sync payout status for all bookings from Stripe',
  })
  async syncMyPayouts(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.payments.syncServiceProviderPayouts(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @Get('employer/receipts')
  @ApiOperation({
    summary: 'List employer receipts (payments made by employer)',
  })
  async listEmployerReceipts(@Req() req: RequestWithUser) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    return this.payments.listEmployerReceipts(employerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @Post('employer/receipts/resend-missing')
  @ApiOperation({
    summary:
      'Resend missing employer receipt emails only (idempotent, employer-only)',
  })
  async resendMissingEmployerReceipts(@Req() req: RequestWithUser) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    return this.payments.resendMissingEmployerReceipts(employerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  @Post('bookings/:bookingId/create-transfer')
  @ApiOperation({
    summary: 'Retroactively create transfer for a completed booking',
  })
  async createMissingTransfer(
    @Req() req: RequestWithUser,
    @Param('bookingId') bookingId: string,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    // Verify booking belongs to user
    const booking = await this.payments['prisma'].booking.findUnique({
      where: { id: bookingId },
      select: { jobSeekerId: true },
    });

    if (!booking || booking.jobSeekerId !== userId) {
      throw new ForbiddenException('Booking not found or access denied');
    }

    return this.payments.createMissingTransfersForBooking(bookingId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('fix-all-missing-transfers')
  @ApiOperation({
    summary: '[ADMIN] Fix all completed bookings missing transfers',
  })
  async fixAllMissingTransfers(@Req() req: RequestWithUser) {
    return this.payments.fixAllMissingTransfers();
  }
}
