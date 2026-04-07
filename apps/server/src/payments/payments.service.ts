import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import {
  PaymentStatusDb,
  StripePaymentType,
  PaymentType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';
import { RatingsService } from '../ratings/ratings.service';
import { ChatService } from '../chat/chat.service';
import { AuthorizeHoldDto } from './dto/authorize-hold.dto';
import { CaptureBookingDto } from './dto/capture-booking.dto';
import { randomUUID } from 'crypto';

// Type guard for Stripe errors
interface StripeError {
  type?: string;
  code?: string;
  message?: string;
  raw?: {
    message?: string;
  };
}

// Type definitions for Prisma JSON fields
interface NegotiationRequest {
  id: string;
  status: string;
  totalAmount?: number;
  counterOffer?: {
    status?: string;
    totalAmount?: number;
  };
}

interface SelectedRate {
  rate: number;
  paymentType: string;
  otherSpecification?: string;
}

interface PaidNegotiation {
  id: string;
  totalAmount: number;
}

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly stripeConfigured: boolean;
  private readonly logger = new Logger(PaymentsService.name);
  private readonly debugLogRateLimitMs = 60_000;
  private readonly debugLogLastAt = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailTranslations: EmailTranslationsService,
    private readonly ratings: RatingsService,
    private readonly chatService: ChatService,
  ) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripeConfigured = Boolean(secret);
    if (!secret) {
      this.logger.warn('STRIPE_SECRET_KEY is not set. Payments will not work.');
    }
    this.stripe = new Stripe(secret ?? '', {
      // Use the latest supported version by the installed Stripe SDK types
      apiVersion: '2024-06-20',
    });
  }

  private assertStripeConfigured() {
    if (this.stripeConfigured) return;
    throw new ServiceUnavailableException(
      'Payments are not configured on the server. Please contact support.',
    );
  }

  private debugOncePerInterval(key: string, message: string) {
    const now = Date.now();
    const last = this.debugLogLastAt.get(key) ?? 0;
    if (now - last < this.debugLogRateLimitMs) return;
    this.debugLogLastAt.set(key, now);
    this.logger.debug(message);

    // Prevent unbounded growth if this service runs long.
    if (this.debugLogLastAt.size > 10_000) {
      const cutoff = now - this.debugLogRateLimitMs * 2;
      for (const [k, t] of this.debugLogLastAt) {
        if (t < cutoff) this.debugLogLastAt.delete(k);
      }
    }
  }

  async createCheckoutSession(params: {
    userId: string;
    priceId?: string;
    amount?: number;
    currency?: string;
    quantity?: number;
    mode?: 'payment' | 'subscription' | 'setup';
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    this.assertStripeConfigured();
    const {
      userId,
      priceId,
      amount,
      currency,
      quantity,
      mode,
      successUrl,
      cancelUrl,
      metadata,
    } = params;

    try {
      const { customerId } = await this.ensureCustomer(userId);

      const sessionParams: any = {
        mode: mode ?? (priceId ? 'payment' : 'payment'),
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
        metadata: {
          userId,
          ...metadata,
        },
      };

      if (mode === 'setup') {
        sessionParams.payment_method_types = ['card'];
      } else {
        sessionParams.line_items = priceId
          ? [
              {
                price: priceId,
                quantity: quantity ?? 1,
              },
            ]
          : amount && currency
            ? [
                {
                  price_data: {
                    currency,
                    product_data: {
                      name: metadata?.description ?? 'Payment',
                    },
                    unit_amount: amount,
                  },
                  quantity: quantity ?? 1,
                },
              ]
            : undefined;
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams);

      await this.prisma.payment.create({
        data: {
          userId,
          type: StripePaymentType.CHECKOUT_SESSION,
          status: PaymentStatusDb.CREATED,
          amount: amount ?? null,
          currency: currency ?? null,
          stripeSessionId: session.id,
          metadata,
        },
      });

      return session;
    } catch (err) {
      this.logger.error('Failed to create checkout session', err as Error);
      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }
  }

  async createPaymentIntent(params: {
    userId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    applicationId?: string;
    platform?: string;
  }) {
    try {
      // Check if payment already exists for this application
      if (params.applicationId) {
        const application = await this.prisma.application.findUnique({
          where: { id: params.applicationId },
          select: {
            paymentId: true,
            payment: {
              select: {
                id: true,
                stripePaymentIntentId: true,
                status: true,
              },
            },
          },
        });

        if (application?.payment?.stripePaymentIntentId) {
          // Try to retrieve the existing payment intent
          try {
            const existingPi = await this.stripe.paymentIntents.retrieve(
              application.payment.stripePaymentIntentId,
            );

            this.logger.log(
              `Found existing payment intent ${existingPi.id} with status ${existingPi.status}, amount: ${existingPi.amount}, requested amount: ${params.amount}`,
            );

            // IMPORTANT (security):
            // `requires_capture` means funds are already authorized (a hold).
            // Do NOT cancel such intents automatically, because canceling releases the hold.
            // If the caller requests the same amount again, treat it as a duplicate and block.
            if (
              existingPi.status === 'requires_capture' &&
              existingPi.amount === params.amount
            ) {
              throw new BadRequestException(
                'A payment authorization already exists for this amount. No new payment is needed. Please refresh payment status.',
              );
            }

            const unusableStatuses = ['succeeded', 'canceled'];
            const isUnusable = unusableStatuses.includes(existingPi.status);

            // Check if the amount matches - if not, we need to cancel and create a new one
            if (existingPi.amount === params.amount && !isUnusable) {
              // Amount matches and payment intent is still valid, return it
              this.logger.log(
                `Reusing existing payment intent with matching amount`,
              );
              return {
                paymentIntent: existingPi,
                payment: await this.prisma.payment.findUnique({
                  where: { id: application.payment.id },
                }),
              };
            } else if (
              existingPi.amount !== params.amount &&
              !isUnusable &&
              existingPi.status !== 'requires_capture'
            ) {
              // Amount doesn't match - cancel the old payment intent
              this.logger.log(
                `Amount mismatch: existing ${existingPi.amount} vs requested ${params.amount}. Canceling old payment intent.`,
              );
              try {
                await this.stripe.paymentIntents.cancel(existingPi.id);
                this.logger.log(`Canceled old payment intent ${existingPi.id}`);
              } catch (cancelError: unknown) {
                const error = cancelError as StripeError;
                this.logger.warn(
                  `Failed to cancel old payment intent: ${error?.message || 'Unknown error'}`,
                );
              }
              // Continue to create new payment intent below
            } else {
              // Payment intent is succeeded or canceled, create new one
              this.logger.log(
                `Existing payment intent is ${existingPi.status}, creating new one`,
              );
            }
          } catch (retrieveError: unknown) {
            // Payment intent doesn't exist or is invalid, continue to create new one
            const error = retrieveError as StripeError;
            this.logger.warn(
              `Existing payment intent ${application.payment.stripePaymentIntentId} not found in Stripe: ${error?.message || 'Unknown error'}`,
            );
          }
        }
      }

      // Ensure Stripe customer exists for the user
      const { customerId } = await this.ensureCustomer(params.userId);

      const statementDescriptor = this.config
        .get<string>('STRIPE_STATEMENT_DESCRIPTOR')
        ?.slice(0, 22);

      // Generate unique idempotency key with UUID to avoid conflicts
      // Use simple UUID-based key since we check for existing payments first
      const idempotencyKey = `pi_${randomUUID()}`;

      this.logger.log(
        `Creating payment intent with idempotency key: ${idempotencyKey.substring(0, 30)}...`,
      );

      // For web platform, find the customer's default payment method to auto-confirm
      let defaultPaymentMethodId: string | null = null;
      if (params.platform === 'web') {
        const customer = await this.stripe.customers.retrieve(customerId);
        if (
          typeof customer === 'object' &&
          !customer.deleted &&
          'invoice_settings' in customer
        ) {
          const defaultPm = customer.invoice_settings?.default_payment_method;
          if (typeof defaultPm === 'string') {
            defaultPaymentMethodId = defaultPm;
          } else if (
            defaultPm &&
            typeof defaultPm === 'object' &&
            'id' in defaultPm
          ) {
            defaultPaymentMethodId = defaultPm.id;
          }
        }
        // If no default, try to get the first available card
        if (!defaultPaymentMethodId) {
          const methods = await this.stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
            limit: 1,
          });
          if (methods.data.length > 0) {
            defaultPaymentMethodId = methods.data[0].id;
          }
        }
        if (!defaultPaymentMethodId) {
          throw new BadRequestException(
            'No payment method found. Please add a payment method before making a payment.',
          );
        }
      }

      const pi = await this.stripe.paymentIntents.create(
        {
          amount: params.amount,
          currency: params.currency,
          customer: customerId, // Link payment intent to customer
          metadata: { userId: params.userId, ...params.metadata },
          automatic_payment_methods: { enabled: true },
          payment_method_options: {
            card: { request_three_d_secure: 'automatic' },
          },
          ...(statementDescriptor && {
            statement_descriptor_suffix: statementDescriptor,
          }),
          // Security policy:
          // - Application payments should be captured immediately (automatic) so funds don't
          //   expire as an authorization hold before acceptance.
          // - Booking/hold flows keep manual capture.
          capture_method:
            params.metadata?.type === 'application_payment'
              ? 'automatic'
              : 'manual',
          // For web: auto-confirm with saved payment method
          ...(defaultPaymentMethodId && {
            payment_method: defaultPaymentMethodId,
            confirm: true,
            return_url:
              (this.config.get<string>('CLIENT_BASE_URL') ||
                'https://nasta.app') + '/dashboard/employer/applications',
          }),
        },
        {
          idempotencyKey,
        },
      );

      // Check if this is an additional payment (payment already succeeded)
      const isAdditionalPayment =
        params.metadata?.isAdditionalPayment === 'true';
      let payment;

      if (isAdditionalPayment && params.applicationId) {
        // Update existing payment record instead of creating new one
        const application = await this.prisma.application.findUnique({
          where: { id: params.applicationId },
          include: { payment: true },
        });

        if (application?.payment) {
          // Update existing payment with new payment intent
          payment = await this.prisma.payment.update({
            where: { id: application.payment.id },
            data: {
              stripePaymentIntentId: pi.id,
              status: PaymentStatusDb.CREATED, // Reset to CREATED for the additional payment
              metadata: params.metadata, // Persist latest metadata (originalAmount/isAdditionalPayment/etc.)
              // Amount will be updated when payment is completed
            },
          });
        } else {
          // Fallback to creating new payment if somehow payment doesn't exist
          const paymentData: any = {
            userId: params.userId,
            type: StripePaymentType.PAYMENT_INTENT,
            status: PaymentStatusDb.CREATED,
            amount: params.amount, // Store in cents (Int) - params.amount is already in cents
            currency: params.currency,
            stripePaymentIntentId: pi.id,
            metadata: params.metadata,
          };

          payment = await this.prisma.payment.create({ data: paymentData });

          if (params.applicationId) {
            await this.prisma.application.update({
              where: { id: params.applicationId },
              data: { paymentId: payment.id },
            });
          }
        }
      } else {
        // Create new payment record
        const paymentData: any = {
          userId: params.userId,
          type: StripePaymentType.PAYMENT_INTENT,
          status: PaymentStatusDb.CREATED,
          amount: params.amount, // Store in cents (Int) - params.amount is already in cents
          currency: params.currency,
          stripePaymentIntentId: pi.id,
          metadata: params.metadata,
        };

        payment = await this.prisma.payment.create({
          data: paymentData,
        });

        // Link payment to application if provided
        if (params.applicationId) {
          await this.prisma.application.update({
            where: { id: params.applicationId },
            data: { paymentId: payment.id },
          });
        }
      }

      return { paymentIntent: pi, payment };
    } catch (err: unknown) {
      const stripeError = err as StripeError;
      this.logger.error('Failed to create payment intent', err);
      this.logger.error('Stripe error details:', {
        type: stripeError?.type,
        code: stripeError?.code,
        message: stripeError?.message,
        raw: stripeError?.raw,
      });

      // Handle idempotency errors - retry with a new key
      if (stripeError?.type === 'StripeIdempotencyError') {
        this.logger.warn('Idempotency key conflict, retrying with new key');
        try {
          // Retry once with a completely new idempotency key
          const { customerId } = await this.ensureCustomer(params.userId);
          const statementDescriptor = this.config
            .get<string>('STRIPE_STATEMENT_DESCRIPTOR')
            ?.slice(0, 22);

          const retryIdempotencyKey = `pi_retry_${randomUUID()}`;

          const pi = await this.stripe.paymentIntents.create(
            {
              amount: params.amount,
              currency: params.currency,
              customer: customerId,
              metadata: { userId: params.userId, ...params.metadata },
              automatic_payment_methods: { enabled: true },
              payment_method_options: {
                card: { request_three_d_secure: 'automatic' },
              },
              ...(statementDescriptor && {
                statement_descriptor_suffix: statementDescriptor,
              }),
              capture_method:
                params.metadata?.type === 'application_payment'
                  ? 'automatic'
                  : 'manual',
            },
            {
              idempotencyKey: retryIdempotencyKey,
            },
          );

          const paymentData: any = {
            userId: params.userId,
            type: StripePaymentType.PAYMENT_INTENT,
            status: PaymentStatusDb.CREATED,
            amount: params.amount,
            currency: params.currency,
            stripePaymentIntentId: pi.id,
            metadata: params.metadata,
          };

          const payment = await this.prisma.payment.create({
            data: paymentData,
          });

          if (params.applicationId) {
            await this.prisma.application.update({
              where: { id: params.applicationId },
              data: { paymentId: payment.id },
            });
          }

          return { paymentIntent: pi, payment };
        } catch {
          // If retry also fails, throw the original error message
          throw new BadRequestException(
            'Unable to process payment. Please try again in a moment.',
          );
        }
      }

      // Only show "payment method required" for specific errors
      const isPaymentMethodError =
        stripeError?.code === 'parameter_invalid_empty' ||
        (typeof stripeError?.message === 'string' &&
          stripeError.message.toLowerCase().includes('payment_method')) ||
        (typeof stripeError?.message === 'string' &&
          stripeError.message.toLowerCase().includes('no payment method')) ||
        (typeof stripeError?.raw?.message === 'string' &&
          stripeError.raw.message.toLowerCase().includes('payment_method'));

      // Provide more specific error messages
      if (stripeError?.type === 'StripeInvalidRequestError') {
        if (isPaymentMethodError) {
          throw new BadRequestException(
            'Payment method required. Please add a payment method in your account settings before proceeding with payment.',
          );
        }
        if (
          typeof stripeError?.message === 'string' &&
          stripeError.message.includes('statement_descriptor')
        ) {
          // This should be fixed now, but handle gracefully
          throw new BadRequestException(
            'Payment configuration error. Please contact support or try again later.',
          );
        }
        // For other invalid request errors, return the actual Stripe error message
        throw new BadRequestException(
          stripeError?.message ||
            'Payment setup issue. Please check your payment information and try again.',
        );
      }

      if (stripeError?.type === 'StripeCardError') {
        throw new BadRequestException(
          'Your card was declined. Please check your card details or use a different payment method.',
        );
      }

      if (stripeError?.type === 'StripeAuthenticationError') {
        throw new BadRequestException(
          'Payment authentication failed. Please verify your payment information and try again.',
        );
      }

      // For other errors, show the actual error message instead of assuming payment method issue
      const errorMessage =
        stripeError?.message ||
        stripeError?.raw?.message ||
        'Unable to process payment. Please try again.';
      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Create payment intent for a job application
   * Calculates fees: 10% platform fee + Stripe fees
   */
  async createApplicationPayment(params: {
    employerId: string;
    applicationId: string;
    amount: number; // Total amount from selected rates (in cents)
    currency: string;
    selectedRates?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>;
    platform?: string;
    clientOrigin?: string;
  }) {
    // PaymentSheet saved-payment-methods support:
    // Provide customer + ephemeral key so the mobile PaymentSheet can display existing cards.
    const { customerId } = await this.ensureCustomer(params.employerId);
    const ephemeralKey = await this.createEphemeralKey(customerId);

    // Log payment creation
    // params.amount is already in cents (from controller)
    this.logger.log(
      `Creating application payment: applicationId=${params.applicationId}, amount=${params.amount} cents (€${(params.amount / 100).toFixed(2)}) ${params.currency}, selectedRates=${params.selectedRates?.length || 0}`,
    );

    // Check if there's an existing completed payment
    let application = await this.prisma.application.findUnique({
      where: { id: params.applicationId },
      include: {
        payment: true,
      },
    });

    // Get accepted negotiations to store in payment metadata
    const negotiationRequests = (application?.negotiationRequests as any) || [];
    const acceptedNegotiations = Array.isArray(negotiationRequests)
      ? negotiationRequests.filter((req: any) => req.status === 'ACCEPTED')
      : [];

    // Store accepted negotiations in metadata (similar to selectedRates)
    const paidNegotiations = acceptedNegotiations.map((neg: any) => ({
      id: neg.id,
      totalAmount:
        neg.counterOffer?.status === 'ACCEPTED'
          ? neg.counterOffer.totalAmount
          : neg.totalAmount || 0,
    }));

    // params.amount is the ADDITIONAL amount to charge (unpaid amount) in cents (from controller)
    // This is the amount that still needs to be paid, not the full total
    const additionalAmountInCents = params.amount;
    let amountToChargeInCents = additionalAmountInCents;
    let isAdditionalPayment = false;

    // Reconcile local payment record with Stripe before deciding whether this
    // is a first payment or additional payment.  The employer may have paid
    // through an earlier checkout that the local record lost track of.
    if (application?.payment && params.applicationId) {
      await this.reconcilePaymentRecord(params.applicationId);
      // Re-read after reconciliation
      const freshApp = await this.prisma.application.findUnique({
        where: { id: params.applicationId },
        include: { payment: true },
      });
      if (freshApp?.payment) {
        application = freshApp;
      }
    }

    if (
      application?.payment &&
      application.payment.status === PaymentStatusDb.SUCCEEDED
    ) {
      // Payment was already completed - we're processing an additional payment
      // application.payment.amount is stored in cents (Int), use directly
      const paidAmountInCents = application.payment.amount || 0;

      // If there's an additional amount to charge, this is an additional payment
      if (additionalAmountInCents > 0.01) {
        amountToChargeInCents = additionalAmountInCents;
        isAdditionalPayment = true;
        this.logger.log(
          `Payment already completed (€${(paidAmountInCents / 100).toFixed(2)} paid). Processing additional payment: ${amountToChargeInCents} cents (€${(amountToChargeInCents / 100).toFixed(2)})`,
        );
      } else {
        // No additional amount to charge - payment already complete
        throw new BadRequestException(
          'Payment already completed for this amount. No additional payment required.',
        );
      }
    }

    // Calculate total amount (in cents, fees are deducted later)
    const totalAmount = amountToChargeInCents;

    // Platform fee is configured (will be deducted from payout)
    const platformFeePercent = this.getPlatformFeeFraction();
    const platformFee = Math.round(totalAmount * platformFeePercent);

    // Stripe fees are ~2.9% + $0.30 (calculated at capture time)
    // For now, we hold the full amount and calculate fees at payout

    // For web platform, use Stripe Checkout Session (redirect to Stripe hosted page)
    if (params.platform === 'web') {
      const clientBaseUrl =
        params.clientOrigin ||
        this.config.get<string>('CLIENT_BASE_URL') ||
        'https://nasta.app';
      const successUrl = `${clientBaseUrl}/dashboard/employer/applications/${params.applicationId}?payment=success`;
      const cancelUrl = `${clientBaseUrl}/dashboard/employer/applications/${params.applicationId}?payment=cancelled`;

      const metadata: Record<string, string> = {
        applicationId: params.applicationId,
        type: 'application_payment',
        userId: params.employerId,
        platformFeePercent: platformFeePercent.toString(),
        isAdditionalPayment: isAdditionalPayment ? 'true' : 'false',
      };
      if (params.selectedRates) {
        metadata.selectedRates = JSON.stringify(params.selectedRates);
      }
      if (paidNegotiations.length > 0) {
        metadata.paidNegotiations = JSON.stringify(paidNegotiations);
      }
      if (isAdditionalPayment && application?.payment?.amount) {
        metadata.originalAmount = application.payment.amount.toString();
      }

      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        customer_update: { name: 'auto', address: 'auto' },
        saved_payment_method_options: {
          payment_method_save: 'enabled',
          allow_redisplay_filters: ['always', 'limited'],
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
          {
            price_data: {
              currency: params.currency,
              product_data: {
                name: 'Service Payment',
                description: `Application payment${isAdditionalPayment ? ' (additional)' : ''}`,
              },
              unit_amount: totalAmount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          setup_future_usage: 'off_session',
          metadata,
        },
        metadata,
      });

      // Create or update payment record
      let payment;
      if (isAdditionalPayment && application?.payment) {
        payment = await this.prisma.payment.update({
          where: { id: application.payment.id },
          data: {
            stripeSessionId: session.id,
            status: PaymentStatusDb.CREATED,
            metadata,
          },
        });
      } else {
        payment = await this.prisma.payment.create({
          data: {
            userId: params.employerId,
            type: StripePaymentType.CHECKOUT_SESSION,
            status: PaymentStatusDb.CREATED,
            amount: totalAmount,
            currency: params.currency,
            stripeSessionId: session.id,
            metadata,
          },
        });
        await this.prisma.application.update({
          where: { id: params.applicationId },
          data: { paymentId: payment.id },
        });
      }

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
        amount: totalAmount,
        currency: params.currency,
        platformFee,
        paymentId: payment.id,
        customer: customerId,
        ephemeralKey,
      };
    }

    // For mobile / other platforms, use PaymentIntent with auto-confirm
    const paymentIntent = await this.createPaymentIntent({
      userId: params.employerId,
      amount: totalAmount,
      currency: params.currency,
      applicationId: params.applicationId,
      platform: params.platform,
      metadata: {
        applicationId: params.applicationId,
        type: 'application_payment',
        platformFeePercent: platformFeePercent.toString(),
        selectedRates: params.selectedRates
          ? JSON.stringify(params.selectedRates)
          : undefined,
        paidNegotiations:
          paidNegotiations.length > 0
            ? JSON.stringify(paidNegotiations)
            : undefined,
        isAdditionalPayment: isAdditionalPayment ? 'true' : 'false',
        originalAmount: isAdditionalPayment
          ? application?.payment?.amount
            ? application.payment.amount.toString()
            : '0'
          : undefined,
      },
    });

    return {
      paymentIntentId: paymentIntent.paymentIntent.id,
      clientSecret: paymentIntent.paymentIntent.client_secret,
      amount: totalAmount,
      currency: params.currency,
      platformFee,
      paymentId: paymentIntent.payment.id,
      customer: customerId,
      ephemeralKey,
      status: paymentIntent.paymentIntent.status,
      nextAction: paymentIntent.paymentIntent.next_action ?? null,
    };
  }

  /**
   * Reconcile the local Payment record with the actual state in Stripe.
   *
   * Employers can start and abandon multiple checkouts. Each new checkout
   * overwrites stripePaymentIntentId / stripeSessionId and resets status to
   * CREATED, even though an earlier PI may have already succeeded in Stripe.
   *
   * This method calls checkApplicationPayment() (which scans ALL Stripe PIs
   * for this application) and, if Stripe shows the payment as completed but
   * the local record still says CREATED, updates the record to SUCCEEDED with
   * the correct PI ID.  This keeps every downstream gate working without
   * restructuring the data model.
   */
  async reconcilePaymentRecord(applicationId: string): Promise<void> {
    try {
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: { payment: true },
      });

      if (!application?.payment) return;

      // If already SUCCEEDED, nothing to reconcile
      if (application.payment.status === PaymentStatusDb.SUCCEEDED) return;

      // Ask Stripe what's really going on
      const stripeStatus = await this.checkApplicationPayment(applicationId);

      if (!stripeStatus.paymentCompleted) return; // genuinely not paid

      // Stripe says paid — find the actual succeeded/captured PI
      const { customerId } = await this.ensureCustomer(
        application.payment.userId,
      );
      const list = await this.stripe.paymentIntents.list({
        customer: customerId,
        limit: 50,
      });

      const completedPi = (list.data || [])
        .filter((pi) => {
          const md = pi.metadata || {};
          return (
            md.applicationId === applicationId &&
            (md.type === 'application_payment' || md.type === undefined)
          );
        })
        .filter(
          (pi) => pi.status === 'succeeded' || pi.status === 'requires_capture',
        )
        .sort((a, b) => (b.created || 0) - (a.created || 0))[0];

      if (!completedPi) return; // shouldn't happen, but be safe

      const totalPaidCents = Math.round((stripeStatus.paidAmount || 0) * 100);

      await this.prisma.payment.update({
        where: { id: application.payment.id },
        data: {
          stripePaymentIntentId: completedPi.id,
          status: PaymentStatusDb.SUCCEEDED,
          amount: totalPaidCents > 0 ? totalPaidCents : undefined,
        },
      });

      this.logger.log(
        `[reconcilePaymentRecord] Reconciled payment for application ${applicationId}: ` +
          `PI ${completedPi.id}, status ${completedPi.status}, amount ${totalPaidCents} cents`,
      );
    } catch (err) {
      this.logger.warn(
        `[reconcilePaymentRecord] Failed for application ${applicationId}: ${err}`,
      );
    }
  }

  /**
   * Check if payment is required and completed for an application
   * Payment is required if a payment record exists (meaning payment was initiated)
   */
  async checkApplicationPayment(applicationId: string): Promise<{
    paymentRequired: boolean;
    paymentCompleted: boolean;
    paymentId?: string;
    paymentIntentId?: string;
    clientSecret?: string;
    paidAmount?: number; // Amount that was already paid (in currency units, not cents)
    paidSelectedRates?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>; // Services that were already paid for
    paidNegotiationAmount?: number; // Amount paid from negotiation (if no services were selected initially)
    unpaidAmount?: number; // Amount that is not yet paid
    paidServices?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
      isPaid: true;
    }>; // Services marked as paid
    unpaidServices?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
      isPaid: false;
    }>; // Services marked as unpaid
    paidNegotiations?: Array<{ id: string; totalAmount: number; isPaid: true }>; // Negotiations marked as paid
    unpaidNegotiations?: Array<{
      id: string;
      totalAmount: number;
      isPaid: false;
    }>; // Negotiations marked as unpaid
  }> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        payment: true,
      },
    });

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    // Payment is required if a payment record exists (meaning payment was initiated)
    // If no payment record exists, payment is not required yet (employer hasn't selected services)
    if (!application.payment) {
      return { paymentRequired: false, paymentCompleted: false };
    }

    const payment = application.payment;

    // Stripe is the source of truth for what was authorized/paid.
    // Do NOT rely solely on the single `stripePaymentIntentId` stored on the Payment record,
    // because additional payments and retries can create multiple intents over time.
    let paymentCompleted = false;

    // If payment intent exists, check its status directly from Stripe
    // This is important because with manual capture, payment might be authorized (requires_capture)
    // but not yet marked as SUCCEEDED in our database
    let clientSecret: string | undefined;
    let paidSelectedRates: SelectedRate[] = [];
    let paidNegotiationsFromMetadata: PaidNegotiation[] = [];
    let hasPaymentIntent = false; // Track if payment intent exists (even if not yet succeeded)

    const parseJsonUnknown = (value: string | undefined): unknown => {
      if (!value) return undefined;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return undefined;
      }
    };

    const isSelectedRate = (value: unknown): value is SelectedRate => {
      if (!value || typeof value !== 'object') return false;
      const record = value as Record<string, unknown>;
      const rate = record.rate;
      const paymentType = record.paymentType;
      const otherSpecification = record.otherSpecification;
      return (
        typeof rate === 'number' &&
        typeof paymentType === 'string' &&
        (otherSpecification === undefined ||
          typeof otherSpecification === 'string')
      );
    };

    const isPaidNegotiation = (value: unknown): value is PaidNegotiation => {
      if (!value || typeof value !== 'object') return false;
      const record = value as Record<string, unknown>;
      return (
        typeof record.id === 'string' && typeof record.totalAmount === 'number'
      );
    };

    const parseSelectedRates = (value: string | undefined): SelectedRate[] => {
      const parsed = parseJsonUnknown(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isSelectedRate);
    };

    const parsePaidNegotiations = (
      value: string | undefined,
    ): PaidNegotiation[] => {
      const parsed = parseJsonUnknown(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isPaidNegotiation);
    };

    const dedupeSelectedRates = (rates: SelectedRate[]): SelectedRate[] => {
      const seen = new Set<string>();
      return rates.filter((rate) => {
        const key = `${rate.paymentType}|${rate.rate}|${rate.otherSpecification ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const dedupePaidNegotiations = (
      negotiations: PaidNegotiation[],
    ): PaidNegotiation[] => {
      const seen = new Set<string>();
      return negotiations.filter((neg) => {
        if (seen.has(neg.id)) return false;
        seen.add(neg.id);
        return true;
      });
    };

    // 1) Prefer scanning all Stripe payment intents for this application by metadata.
    // This makes paid/unpaid and totals match Stripe even when we rotated `stripePaymentIntentId`.
    let stripePaidAmountInCents: number | null = null;
    try {
      if (payment.userId) {
        const { customerId } = await this.ensureCustomer(payment.userId);
        const list = await this.stripe.paymentIntents.list({
          customer: customerId,
          limit: 50,
        });

        const appIntents = (list.data || []).filter((pi) => {
          const md = pi.metadata || {};
          return (
            md.applicationId === applicationId &&
            (md.type === 'application_payment' || md.type === undefined)
          );
        });

        if (appIntents.length > 0) {
          hasPaymentIntent = true;

          // Treat Stripe as the source of truth for what is actually paid/authorized.
          // In rare cases PaymentSheet can return success while the PI is still `processing`.
          // Only count `processing` as paid if Stripe reports a non-zero `amount_received`.
          const completed = appIntents.filter((pi) => {
            if (pi.status === 'succeeded' || pi.status === 'requires_capture') {
              return true;
            }
            if (pi.status === 'processing') {
              const received =
                typeof pi.amount_received === 'number' ? pi.amount_received : 0;
              return received > 0;
            }
            return false;
          });

          const latestCompleted = completed
            .slice()
            .sort((a, b) => (b.created || 0) - (a.created || 0))[0];

          if (completed.length > 0) {
            paymentCompleted = true;
            stripePaidAmountInCents = completed.reduce((sum, pi) => {
              // For `requires_capture` we count the authorized amount.
              if (pi.status === 'requires_capture') {
                return sum + (pi.amount ? Math.round(pi.amount) : 0);
              }
              // For `succeeded` we prefer amount_received (covers partial captures),
              // otherwise fall back to amount.
              const received =
                typeof pi.amount_received === 'number'
                  ? Math.round(pi.amount_received)
                  : 0;
              if (received > 0) return sum + received;
              return sum + (pi.amount ? Math.round(pi.amount) : 0);
            }, 0);
          }

          // Use ALL completed intents' metadata (union) so paid items match Stripe when
          // additional payments / retries created multiple payment intents.
          if (completed.length > 0) {
            const allPaidSelectedRates = completed.flatMap((pi) =>
              parseSelectedRates(pi.metadata?.selectedRates),
            );
            const allPaidNegotiations = completed.flatMap((pi) =>
              parsePaidNegotiations(pi.metadata?.paidNegotiations),
            );
            paidSelectedRates = dedupeSelectedRates(allPaidSelectedRates);
            paidNegotiationsFromMetadata =
              dedupePaidNegotiations(allPaidNegotiations);
          } else if (latestCompleted) {
            // Backward compatibility: keep previous behavior if we somehow have a latest
            // completed intent but the completed array isn't available.
            paidSelectedRates = parseSelectedRates(
              latestCompleted.metadata?.selectedRates,
            );
            paidNegotiationsFromMetadata = parsePaidNegotiations(
              latestCompleted.metadata?.paidNegotiations,
            );
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `[Payment Status] Failed to list payment intents for application ${applicationId}. Falling back to stored intent id.`,
        err as Error,
      );
    }

    // 2) Fallback: if listing failed or we have no intents, use the stored PI id.
    if (!hasPaymentIntent && payment.stripePaymentIntentId) {
      try {
        const pi = await this.stripe.paymentIntents.retrieve(
          payment.stripePaymentIntentId,
        );

        hasPaymentIntent = true; // Payment intent exists (regardless of status)

        // CRITICAL: Only read metadata from payment intents that are actually completed
        // Do NOT read metadata from incomplete, canceled, cancelled, or failed payment intents
        // Only succeeded, requires_capture, and processing indicate actual payment
        // Explicitly exclude all non-completed statuses
        const completedStatuses = [
          'succeeded',
          'requires_capture',
          'processing',
        ];
        const excludedStatuses = [
          'canceled',
          'cancelled',
          'incomplete',
          'requires_payment_method',
          'requires_confirmation',
          'requires_action',
        ];
        const isPaymentIntentCompleted =
          completedStatuses.includes(pi.status) &&
          !excludedStatuses.includes(pi.status);

        // Get paid selected rates from payment intent metadata
        // ONLY if the payment intent is actually completed
        if (isPaymentIntentCompleted && pi.metadata?.selectedRates) {
          paidSelectedRates = parseSelectedRates(pi.metadata.selectedRates);
        }

        // Get paid negotiations from payment intent metadata
        // CRITICAL: Only read from payment intents that are actually completed
        // Incomplete payment intents should NOT be counted as paid
        if (isPaymentIntentCompleted && pi.metadata?.paidNegotiations) {
          paidNegotiationsFromMetadata = parsePaidNegotiations(
            pi.metadata.paidNegotiations,
          );
          // Log when we find paid negotiations in completed payment intents
          this.logger.log(
            `Found ${paidNegotiationsFromMetadata.length} paid negotiations in payment intent metadata (payment status: ${pi.status})`,
          );
        } else if (pi.metadata?.paidNegotiations && !isPaymentIntentCompleted) {
          // Log when we skip incomplete/cancelled payment intents
          this.logger.warn(
            `Skipping paid negotiations from payment intent with status '${pi.status}'. Payment intent ID: ${pi.id}, Amount: ${pi.amount ? (pi.amount / 100).toFixed(2) : 'N/A'} EUR. This payment was not completed and should not be counted as paid.`,
          );
        }

        // CRITICAL: Verify and correct the amount.
        // Stripe amount is in cents, database should also be in cents.
        // For additional payments, Stripe only reflects the *additional* amount; we must store the cumulative total.
        const stripeAmountInCents = pi.amount ? Math.round(pi.amount) : null;
        const dbAmount = payment.amount || 0;

        const isAdditionalPayment = pi.metadata?.isAdditionalPayment === 'true';
        // For additional payments, Stripe PI amount is only the additional charge.
        // Prefer PI metadata.originalAmount when present; otherwise fall back to the DB amount.
        const parsedOriginalAmountInCents = isAdditionalPayment
          ? Number.parseInt(pi.metadata?.originalAmount || '0', 10)
          : 0;
        const originalAmountInCents = isAdditionalPayment
          ? Number.isFinite(parsedOriginalAmountInCents) &&
            parsedOriginalAmountInCents > 0
            ? parsedOriginalAmountInCents
            : dbAmount
          : 0;

        const expectedTotalAmountInCents = isAdditionalPayment
          ? Math.max(
              0,
              (Number.isFinite(originalAmountInCents)
                ? originalAmountInCents
                : 0) + (stripeAmountInCents ?? 0),
            )
          : (stripeAmountInCents ?? dbAmount);

        // If expected amount exists and doesn't match database, correct it
        if (expectedTotalAmountInCents !== dbAmount) {
          this.logger.warn(
            `[Payment Amount Correction] Payment ${payment.id} has incorrect amount in database. ` +
              `DB: ${dbAmount} cents (${(dbAmount / 100).toFixed(2)} EUR), ` +
              `Expected: ${expectedTotalAmountInCents} cents (${(expectedTotalAmountInCents / 100).toFixed(2)} EUR), ` +
              `Stripe PI amount: ${stripeAmountInCents ?? 'n/a'} cents. ` +
              (isAdditionalPayment
                ? `Additional payment detected. originalAmount=${originalAmountInCents} cents.`
                : `Primary payment.`),
          );
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              amount: expectedTotalAmountInCents,
            },
          });
          payment.amount = expectedTotalAmountInCents; // Update local object
        }

        // Payment is considered completed if:
        // 1. Payment intent is succeeded
        // 2. Payment intent is requires_capture (authorized, ready to capture)
        const isAuthorizedOrSucceeded =
          pi.status === 'succeeded' || pi.status === 'requires_capture';

        if (isAuthorizedOrSucceeded) {
          // Payment intent is authorized/succeeded but database isn't updated yet
          // Store amount in cents (as Int)
          // For additional payments, store cumulative total (original + additional).
          const paidAmountInCents = expectedTotalAmountInCents;

          this.logger.log(
            `Payment intent ${pi.id} is ${pi.status}, updating database to SUCCEEDED with amount ${paidAmountInCents} cents (${(paidAmountInCents / 100).toFixed(2)} EUR)`,
          );
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatusDb.SUCCEEDED,
              amount: paidAmountInCents, // Store in cents (Int)
              currency: pi.currency || payment.currency || undefined,
            },
          });
          paymentCompleted = true;
          // Update the payment object for return value (keep in cents for now)
          payment.amount = paidAmountInCents;
        } else if (
          pi.status === 'succeeded' ||
          pi.status === 'requires_capture'
        ) {
          paymentCompleted = true;
          // Ensure amount is set correctly in database.
          if (payment.amount !== expectedTotalAmountInCents) {
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                amount: expectedTotalAmountInCents,
              },
            });
            payment.amount = expectedTotalAmountInCents;
          }
        }

        // Get client secret if payment is not completed
        if (!paymentCompleted) {
          clientSecret = pi.client_secret || undefined;
        }
      } catch (err) {
        this.logger.warn(
          `Failed to retrieve payment intent ${payment.stripePaymentIntentId}`,
          err,
        );
      }
    }

    // Calculate paid vs unpaid breakdown
    const currentSelectedRates =
      (application.selectedRates as unknown as SelectedRate[]) || [];
    const currentNegotiations =
      (application.negotiationRequests as unknown as NegotiationRequest[]) ||
      [];
    const acceptedNegotiations = Array.isArray(currentNegotiations)
      ? currentNegotiations.filter((req) => req.status === 'ACCEPTED')
      : [];

    // Helper function to match services
    const matchService = (
      service1: SelectedRate,
      service2: SelectedRate,
    ): boolean => {
      return (
        Math.abs(service1.rate - service2.rate) < 0.01 &&
        service1.paymentType === service2.paymentType &&
        (service1.otherSpecification || '') ===
          (service2.otherSpecification || '')
      );
    };

    // Determine which services are paid vs unpaid
    const paidServices: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
      isPaid: true;
    }> = [];
    const unpaidServices: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
      isPaid: false;
    }> = [];

    // Check selected rates
    if (Array.isArray(currentSelectedRates)) {
      currentSelectedRates.forEach((service) => {
        const isPaid = paidSelectedRates.some((paid) =>
          matchService(service, paid),
        );
        if (isPaid) {
          paidServices.push({ ...service, isPaid: true });
        } else {
          unpaidServices.push({ ...service, isPaid: false });
        }
      });
    }

    // Calculate total required amounts first
    const totalServicesAmount = Array.isArray(currentSelectedRates)
      ? currentSelectedRates.reduce(
          (sum: number, service) => sum + (service.rate || 0),
          0,
        )
      : 0;
    const totalNegotiationsAmount = Array.isArray(acceptedNegotiations)
      ? acceptedNegotiations.reduce((sum: number, neg) => {
          const negAmount =
            neg.counterOffer?.status === 'ACCEPTED'
              ? neg.counterOffer.totalAmount || 0
              : neg.totalAmount || 0;
          return sum + (negAmount || 0);
        }, 0)
      : 0;

    const totalRequiredAmount = totalServicesAmount + totalNegotiationsAmount;

    // Paid amount should match Stripe (authorized/succeeded holds) for this application.
    // If we successfully scanned Stripe intents, use that sum; otherwise fall back to the DB amount.
    const paidAmountFromStripe =
      stripePaidAmountInCents !== null ? stripePaidAmountInCents / 100 : null;
    // Never treat a CREATED payment record as paid.
    // We set `payment.amount` when creating the intent, but that is just the intended charge.
    // Only consider DB amount as paid when we've marked the payment SUCCEEDED.
    const paidAmountFromDb =
      payment.status === PaymentStatusDb.SUCCEEDED
        ? (payment.amount || 0) / 100
        : 0;
    const paidAmountForAllocation =
      (paidAmountFromStripe ?? paidAmountFromDb) || 0;

    // Determine which negotiations are paid vs unpaid FIRST
    // This is critical to calculate the correct paid amount
    const paidNegotiations: Array<{
      id: string;
      totalAmount: number;
      isPaid: true;
    }> = [];
    const unpaidNegotiations: Array<{
      id: string;
      totalAmount: number;
      isPaid: false;
    }> = [];

    // Calculate amount allocated to paid services.
    // IMPORTANT: Only subtract services that are currently required (application.selectedRates)
    // and actually matched as paid. Using all historical paidSelectedRates metadata here can
    // incorrectly consume allocation and cause negotiations to appear unpaid.
    const paidServicesAmountRaw = paidServices.reduce(
      (sum: number, service) => sum + (service.rate || 0),
      0,
    );
    const paidServicesAmount = Math.min(
      paidServicesAmountRaw,
      totalServicesAmount,
      paidAmountForAllocation,
    );

    // Allocate paid amount across services first, then negotiations.
    // This ensures the paid/unpaid line-items are consistent with paidAmount/unpaidAmount.
    let remainingPaidAmount = paidAmountForAllocation - paidServicesAmount;

    // Check negotiations: ONLY mark as paid if they're actually in payment metadata
    // DO NOT mark as paid based on amount calculations - that's unreliable
    acceptedNegotiations.forEach((neg) => {
      const negAmount =
        neg.counterOffer?.status === 'ACCEPTED'
          ? neg.counterOffer.totalAmount || 0
          : neg.totalAmount || 0;

      // ONLY check if this negotiation is in the paid negotiations from metadata
      // AND the payment is actually completed (succeeded or requires_capture)
      // We should NOT mark negotiations as paid just because they're in metadata of a payment intent
      // that hasn't been completed yet - the payment must actually be authorized/succeeded
      const isInPaidMetadata = paidNegotiationsFromMetadata.some(
        (paidNeg) => paidNeg.id === neg.id,
      );

      let isPaid = false;
      if (paymentCompleted && isInPaidMetadata) {
        // Only mark as paid if Stripe-paid amount can cover it.
        if (remainingPaidAmount >= negAmount) {
          isPaid = true;
          remainingPaidAmount -= negAmount;
        }
      }

      // Only log debug info when payment is actually completed but negotiation is still not marked as paid
      // This helps identify issues without flooding logs during normal polling
      if (hasPaymentIntent && !isPaid && paymentCompleted) {
        this.debugOncePerInterval(
          `neg-not-paid:${applicationId}:${neg.id}`,
          `Negotiation ${neg.id} (amount: ${negAmount}) not marked as paid despite payment completion. In metadata: ${isInPaidMetadata}`,
        );
      }

      // REMOVED: The "everythingIsPaid" check was incorrect - it would mark new negotiations
      // as paid even if they weren't included in any payment. This caused the 0.50 EUR
      // negotiation to be incorrectly marked as paid.

      // Fallback ONLY for old payments without metadata (backward compatibility)
      // If metadata is missing, infer from remaining paid amount.
      if (!isPaid && paidNegotiationsFromMetadata.length === 0) {
        if (remainingPaidAmount >= negAmount && remainingPaidAmount > 0.01) {
          isPaid = true;
          remainingPaidAmount -= negAmount;
        }
      }

      if (isPaid) {
        paidNegotiations.push({
          id: neg.id,
          totalAmount: negAmount,
          isPaid: true,
        });
      } else {
        // This negotiation was not included in any payment
        unpaidNegotiations.push({
          id: neg.id,
          totalAmount: negAmount,
          isPaid: false,
        });
      }
    });

    const finalPaidAmount = Math.min(
      (paidAmountFromStripe ?? paidAmountFromDb) || 0,
      totalRequiredAmount,
    );

    // Calculate unpaid amount
    const unpaidAmountRaw = Math.max(0, totalRequiredAmount - finalPaidAmount);
    const unpaidAmount = unpaidAmountRaw > 0.01 ? unpaidAmountRaw : 0;

    const isFullyPaid = paymentCompleted && unpaidAmount === 0;
    const hasCurrentSelectedRates =
      Array.isArray(currentSelectedRates) && currentSelectedRates.length > 0;
    const hasAcceptedNegotiations =
      Array.isArray(acceptedNegotiations) && acceptedNegotiations.length > 0;

    const paidSelectedRatesForResult =
      isFullyPaid && hasCurrentSelectedRates
        ? dedupeSelectedRates([...paidSelectedRates, ...currentSelectedRates])
        : paidSelectedRates;

    const paidServicesForResult = isFullyPaid
      ? hasCurrentSelectedRates
        ? currentSelectedRates.map((service) => ({
            ...service,
            isPaid: true as const,
          }))
        : undefined
      : paidServices.length > 0
        ? paidServices
        : undefined;

    const unpaidServicesForResult = isFullyPaid
      ? undefined
      : unpaidServices.length > 0
        ? unpaidServices
        : undefined;

    const paidNegotiationsForResult = isFullyPaid
      ? hasAcceptedNegotiations
        ? acceptedNegotiations.map((neg) => {
            const negAmount =
              neg.counterOffer?.status === 'ACCEPTED'
                ? neg.counterOffer.totalAmount || 0
                : neg.totalAmount || 0;
            return {
              id: neg.id,
              totalAmount: negAmount,
              isPaid: true as const,
            };
          })
        : undefined
      : paidNegotiations.length > 0
        ? paidNegotiations
        : undefined;

    const unpaidNegotiationsForResult = isFullyPaid
      ? undefined
      : unpaidNegotiations.length > 0
        ? unpaidNegotiations
        : undefined;

    const result = {
      paymentRequired: true,
      paymentCompleted,
      paymentId: payment.id,
      paymentIntentId: payment.stripePaymentIntentId || undefined,
      clientSecret,
      // Return the calculated paid amount (from metadata) - this is the source of truth
      paidAmount: finalPaidAmount > 0 ? finalPaidAmount : undefined,
      paidSelectedRates: paidSelectedRatesForResult,
      unpaidAmount: unpaidAmount > 0 ? unpaidAmount : undefined,
      paidServices: paidServicesForResult,
      unpaidServices: unpaidServicesForResult,
      paidNegotiations: paidNegotiationsForResult,
      unpaidNegotiations: unpaidNegotiationsForResult,
    };

    return result;
  }

  // Stripe webhook handler
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const endpointSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!endpointSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET is not set. Skipping signature verification.',
      );
    }
    let event: Stripe.Event;
    try {
      if (endpointSecret && signature) {
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          endpointSecret,
        );
      } else {
        event = JSON.parse(rawBody.toString()) as Stripe.Event;
      }
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err as Error);
      throw err;
    }

    // Log webhook receipt for debugging
    this.logger.log(`📥 Webhook received: ${event.type} (ID: ${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata ?? {};
        const receivedAmount = session.amount_total
          ? Math.round(session.amount_total)
          : undefined;

        const isAdditional = meta['isAdditionalPayment'] === 'true';

        let payment = await this.prisma.payment.findFirst({
          where: { stripeSessionId: session.id },
        });

        // Fallback: if primary lookup fails (session ID was overwritten by a
        // newer checkout), find the payment by applicationId instead.
        if (!payment && meta['applicationId']) {
          const app = await this.prisma.application.findUnique({
            where: { id: meta['applicationId'] },
            include: { payment: true },
          });
          if (app?.payment) {
            payment = app.payment;
            this.logger.log(
              `[Webhook] checkout.session.completed: Primary lookup by sessionId failed. ` +
                `Found payment ${payment.id} via applicationId ${meta['applicationId']}`,
            );
          }
        }

        let paidAmount = receivedAmount;
        if (isAdditional && payment && receivedAmount !== undefined) {
          const originalAmount =
            Number.parseInt(meta['originalAmount'] || '0', 10) ||
            payment.amount ||
            0;
          paidAmount = Math.max(0, originalAmount + receivedAmount);
        }

        // Store the underlying PaymentIntent ID so the payment record
        // is linked to the Stripe payment method / charge.
        const piId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? undefined);

        // Update by payment ID if we found it (handles overwritten sessionId),
        // otherwise fall back to sessionId match.
        if (payment) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatusDb.SUCCEEDED,
              amount: paidAmount, // Store in cents (Int)
              currency: session.currency ?? undefined,
              stripeSessionId: session.id, // restore correct session link
              ...(piId ? { stripePaymentIntentId: piId } : {}),
            },
          });
        } else {
          await this.prisma.payment.updateMany({
            where: { stripeSessionId: session.id },
            data: {
              status: PaymentStatusDb.SUCCEEDED,
              amount: paidAmount,
              currency: session.currency ?? undefined,
              ...(piId ? { stripePaymentIntentId: piId } : {}),
            },
          });
        }

        const applicationId = meta['applicationId'];
        if (applicationId) {
          this.logger.log(
            `💰 Checkout session completed for application ${applicationId}. Amount: ${paidAmount} cents, PI: ${piId}`,
          );
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        this.logger.log(
          `💳 Processing payment_intent.succeeded: ${pi.id}, amount: ${pi.amount} ${pi.currency}, status: ${pi.status}`,
        );

        let payment = await this.prisma.payment.findFirst({
          where: { stripePaymentIntentId: pi.id },
        });

        // Fallback: if primary lookup fails (PI ID was overwritten by a newer
        // checkout attempt), find the payment via applicationId metadata.
        if (!payment && pi.metadata?.['applicationId']) {
          const app = await this.prisma.application.findUnique({
            where: { id: pi.metadata['applicationId'] },
            include: { payment: true },
          });
          if (app?.payment) {
            payment = app.payment;
            this.logger.log(
              `[Webhook] payment_intent.succeeded: Primary lookup by PI failed. ` +
                `Found payment ${payment.id} via applicationId ${pi.metadata['applicationId']}`,
            );
          }
        }

        if (payment) {
          this.logger.log(
            `✅ Found payment record ${payment.id} for payment intent ${pi.id}`,
          );
          // Store amount in cents (as Int).
          // IMPORTANT: for additional payments, Stripe PI amount is only the delta.
          // Keep Payment.amount as the cumulative total paid for the application.
          const receivedOrAmountInCents =
            typeof pi.amount_received === 'number' && pi.amount_received > 0
              ? Math.round(pi.amount_received)
              : pi.amount
                ? Math.round(pi.amount)
                : undefined;

          const isAdditionalPayment =
            pi.metadata?.['isAdditionalPayment'] === 'true';
          const parsedOriginalAmountInCents = isAdditionalPayment
            ? Number.parseInt(pi.metadata?.['originalAmount'] || '0', 10)
            : 0;
          const originalAmountInCents =
            isAdditionalPayment &&
            Number.isFinite(parsedOriginalAmountInCents) &&
            parsedOriginalAmountInCents > 0
              ? parsedOriginalAmountInCents
              : payment.amount || 0;

          const paidAmountInCents =
            receivedOrAmountInCents === undefined
              ? undefined
              : isAdditionalPayment
                ? Math.max(0, originalAmountInCents + receivedOrAmountInCents)
                : receivedOrAmountInCents;

          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatusDb.SUCCEEDED,
              amount: paidAmountInCents, // Store in cents (Int) - NOT currency units
              currency: pi.currency ?? undefined,
              stripePaymentIntentId: pi.id, // always store the correct PI
            },
          });

          this.logger.log(
            `✅ Updated payment ${payment.id} to SUCCEEDED with amount ${paidAmountInCents} cents (${(paidAmountInCents / 100).toFixed(2)} ${pi.currency})`,
          );

          // If this is an application payment, we can now allow actions
          const applicationId = pi.metadata?.['applicationId'];
          if (applicationId) {
            const paidAmountInCurrency = paidAmountInCents
              ? paidAmountInCents / 100
              : 0;
            this.logger.log(
              `💰 Payment succeeded for application ${applicationId}. Amount paid: ${paidAmountInCurrency} ${pi.currency} (${paidAmountInCents} cents)`,
            );
          }
        } else {
          this.logger.warn(
            `⚠️ Payment intent ${pi.id} succeeded but no payment record found in database`,
          );
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        // Don't revert SUCCEEDED — a different PI for the same app may have
        // already succeeded even though this one failed.
        await this.prisma.payment.updateMany({
          where: {
            stripePaymentIntentId: pi.id,
            status: { not: PaymentStatusDb.SUCCEEDED },
          },
          data: {
            status: PaymentStatusDb.FAILED,
          },
        });
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        // Only mark as canceled if the payment isn't already SUCCEEDED.
        // An employer may have paid via an earlier session/PI while a newer
        // checkout session expired — we must not revert the SUCCEEDED status.
        await this.prisma.payment.updateMany({
          where: {
            stripeSessionId: session.id,
            status: { not: PaymentStatusDb.SUCCEEDED },
          },
          data: { status: PaymentStatusDb.CANCELED },
        });
        break;
      }
      default: {
        // Handle event types not in Stripe's TypeScript discriminated union
        const eventType = event.type as string;
        const rawData = (event as any).data?.object;

        if (eventType === 'transfer.paid' && rawData) {
          // A transfer to a Connected Account has been paid out to their bank
          const transfer = rawData as Stripe.Transfer;
          const transferId = transfer.id;
          this.logger.log(
            `🏦 Transfer paid: ${transferId}, amount: ${transfer.amount}, destination: ${transfer.destination}`,
          );

          // Find the booking with this transfer ID and update payout status
          const booking = await this.prisma.booking.findFirst({
            where: { stripeTransferId: transferId },
          });

          if (booking) {
            await this.prisma.booking.update({
              where: { id: booking.id },
              data: {
                payoutStatus: 'paid',
                payoutDate: new Date(),
              },
            });
            this.logger.log(
              `✅ Updated booking ${booking.id} payoutStatus to 'paid' for transfer ${transferId}`,
            );
          } else {
            this.logger.warn(
              `⚠️ Transfer ${transferId} paid but no matching booking found`,
            );
          }
        } else if (eventType === 'payout.paid' && rawData) {
          // A payout to a Connected Account's bank has been completed
          const payout = rawData as Stripe.Payout;
          const connectedAccountId = (event as any).account as string | undefined;
          this.logger.log(
            `🏦 Payout paid: ${payout.id}, amount: ${payout.amount}, account: ${connectedAccountId}`,
          );

          if (connectedAccountId) {
            const user = await this.prisma.user.findFirst({
              where: { connectedAccountId },
            });

            if (user) {
              const result = await this.prisma.booking.updateMany({
                where: {
                  jobSeekerId: user.id,
                  payoutStatus: 'pending',
                  stripeTransferId: { not: null },
                },
                data: {
                  payoutStatus: 'paid',
                  payoutDate: new Date(payout.arrival_date * 1000),
                },
              });
              this.logger.log(
                `✅ Updated ${result.count} bookings to 'paid' for user ${user.id} (payout ${payout.id})`,
              );
            }
          }
        } else {
          this.logger.debug(
            `Unhandled webhook event type: ${event.type} (ID: ${event.id})`,
          );
        }
        break;
      }
    }

    this.logger.log(
      `✅ Webhook processed successfully: ${event.type} (ID: ${event.id})`,
    );
    return { received: true };
  }

  async listPaymentsForUser(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // -- Dashboards --
  async getJobSeekerDashboard(userId: string) {
    const [bookings, user] = await Promise.all([
      this.prisma.booking.findMany({
        where: { jobSeekerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { connectedAccountId: true },
      }),
    ]);
    let pendingHolds = 0;
    let capturedTotal = 0;
    let paidToBank = 0;
    for (const b of bookings) {
      if (b.capturedAmount && b.capturedAmount > 0) {
        capturedTotal += b.capturedAmount;
        if (b.payoutStatus === 'paid') {
          paidToBank += b.capturedAmount;
        }
      } else if (b.holdAmount && b.holdAmount > 0) {
        pendingHolds += b.holdAmount;
      }
    }
    const recent = bookings.slice(0, 10).map((b) => ({
      id: b.id,
      status: b.status,
      holdAmount: b.holdAmount,
      capturedAmount: b.capturedAmount,
      startTime: b.startTime,
      endTime: b.endTime,
    }));
    // capturedAmount is already the net amount after platform fee (serviceProviderAmount)
    // So estimatedNet should just be the sum of capturedAmount values
    const estimatedNet = capturedTotal;
    return {
      pendingHolds,
      capturedTotal,
      estimatedNet,
      paidToBank,
      hasConnectedAccount: !!user?.connectedAccountId,
      recent,
    };
  }

  async getEmployerDashboard(userId: string) {
    // Include both direct (booking.employerId) and job-based (booking.job.employerId)
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [{ employerId: userId }, { job: { employerId: userId } }],
      },
      include: { job: { select: { employerId: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    let authorizedHolds = 0;
    let totalSpent = 0;
    for (const b of bookings) {
      if (b.capturedAmount && b.capturedAmount > 0)
        totalSpent += b.capturedAmount;
      else if (b.holdAmount && b.holdAmount > 0)
        authorizedHolds += b.holdAmount;
    }
    const recent = bookings.slice(0, 10).map((b) => ({
      id: b.id,
      status: b.status,
      holdAmount: b.holdAmount,
      capturedAmount: b.capturedAmount,
      startTime: b.startTime,
      endTime: b.endTime,
    }));
    return {
      authorizedHolds,
      totalSpent,
      recent,
    };
  }

  // -- Customer Management --
  async ensureCustomer(userId: string) {
    this.assertStripeConfigured();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new InternalServerErrorException('User not found');

    if (user.stripeCustomerId) {
      // Verify customer exists in Stripe, if not, create a new one
      try {
        await this.stripe.customers.retrieve(user.stripeCustomerId);
        return { customerId: user.stripeCustomerId };
      } catch {
        // Customer doesn't exist in Stripe, create a new one
        this.logger.warn(
          `Customer ${user.stripeCustomerId} not found in Stripe, creating new customer for user ${userId}`,
        );
        // Continue to create new customer below
      }
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return { customerId: customer.id };
  }

  async createSetupIntent(userId: string) {
    this.assertStripeConfigured();
    const { customerId } = await this.ensureCustomer(userId);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // Allow future charges without user presence
    });

    const ephemeralKey = await this.createEphemeralKey(customerId);

    return {
      clientSecret: setupIntent.client_secret,
      ephemeralKey: ephemeralKey,
      customer: customerId,
    };
  }

  private async createEphemeralKey(customerId: string) {
    const key = await this.stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2024-06-20' },
    );
    return key.secret;
  }

  /**
   * List all payment methods for a customer
   */
  async listPaymentMethods(userId: string) {
    this.assertStripeConfigured();
    const { customerId } = await this.ensureCustomer(userId);

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    // Get customer to check default payment method
    const customer = await this.stripe.customers.retrieve(customerId);
    const defaultPaymentMethodId =
      typeof customer === 'object' &&
      !customer.deleted &&
      'invoice_settings' in customer
        ? customer.invoice_settings?.default_payment_method
        : null;

    return paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : null,
      isDefault: pm.id === defaultPaymentMethodId,
      created: pm.created,
    }));
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    this.assertStripeConfigured();
    const { customerId } = await this.ensureCustomer(userId);

    // Verify the payment method belongs to this customer
    const paymentMethod =
      await this.stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer !== customerId) {
      throw new ForbiddenException(
        'Payment method does not belong to this user',
      );
    }

    // Detach the payment method
    await this.stripe.paymentMethods.detach(paymentMethodId);

    return { success: true, message: 'Payment method deleted successfully' };
  }

  /**
   * Set default payment method for a customer
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    const { customerId } = await this.ensureCustomer(userId);

    // Verify the payment method belongs to this customer
    const paymentMethod =
      await this.stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer !== customerId) {
      throw new ForbiddenException(
        'Payment method does not belong to this user',
      );
    }

    // Update customer's default payment method
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return {
      success: true,
      message: 'Default payment method updated successfully',
    };
  }

  async getConnectAccountStatus(userId: string, clientIp?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userProfile: true },
    });

    if (!user?.connectedAccountId) {
      return {
        isEnabled: false,
        detailsSubmitted: false,
        bankAccounts: [],
      };
    }

    // Always update the account with latest profile information when checking status
    // This ensures any new profile updates are synced to Stripe
    this.logger.log(
      '[PaymentsService] getConnectAccountStatus - Syncing profile information to Stripe:',
      {
        userId,
        hasProfile: !!user.userProfile,
        hasPhone: !!user.phone,
        hasDOB: !!user.userProfile?.dateOfBirth,
        hasAddress: !!(
          user.userProfile?.addressLine1 || user.userProfile?.city
        ),
      },
    );
    await this.updateConnectAccountWithRequiredFields(
      user.connectedAccountId,
      user,
      clientIp,
    );

    const account = await this.stripe.accounts.retrieve(
      user.connectedAccountId,
    );

    // Retrieve external accounts (bank accounts) for this Connect account
    let bankAccounts: any[] = [];
    try {
      const externalAccounts = await this.stripe.accounts.listExternalAccounts(
        user.connectedAccountId,
        {
          object: 'bank_account',
          limit: 10,
        },
      );

      bankAccounts = externalAccounts.data.map((bankAccount: any) => ({
        id: bankAccount.id,
        accountHolderName: bankAccount.account_holder_name,
        accountHolderType: bankAccount.account_holder_type,
        bankName: bankAccount.bank_name,
        country: bankAccount.country,
        currency: bankAccount.currency,
        last4: bankAccount.last4,
        routingNumber: bankAccount.routing_number,
        // For IBAN accounts, show masked IBAN
        iban: bankAccount.account_number
          ? bankAccount.account_number.length > 4
            ? `****${bankAccount.account_number.slice(-4)}`
            : bankAccount.account_number
          : undefined,
        status: bankAccount.status,
        defaultForCurrency: bankAccount.default_for_currency,
      }));

      this.logger.log(
        `Retrieved ${bankAccounts.length} bank account(s) for user ${userId}`,
      );
    } catch (error: any) {
      this.logger.warn(`Failed to retrieve bank accounts: ${error.message}`);
      // Don't fail the whole request if bank account retrieval fails
    }

    // Get detailed requirements information
    const currentlyDue = account.requirements?.currently_due || [];
    const eventuallyDue = account.requirements?.eventually_due || [];
    const pastDue = account.requirements?.past_due || [];
    const disabledReason = account.requirements?.disabled_reason;

    // Log account status for debugging
    this.logger.log('[PaymentsService] Account status check:', {
      accountId: account.id.substring(0, 12) + '...',
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      currentlyDueCount: currentlyDue.length,
      pastDueCount: pastDue.length,
      disabledReason: disabledReason,
      capabilities: {
        cardPayments: account.capabilities?.card_payments,
        transfers: account.capabilities?.transfers,
      },
    });

    return {
      isEnabled: account.payouts_enabled && account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: {
        currentlyDue: currentlyDue,
        eventuallyDue: eventuallyDue,
        pastDue: pastDue,
        disabledReason: disabledReason,
      },
      bankAccounts: bankAccounts,
      accountId: user.connectedAccountId,
      // Additional status info
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      capabilities: {
        cardPayments: account.capabilities?.card_payments,
        transfers: account.capabilities?.transfers,
      },
    };
  }

  // -- Stripe Connect Custom accounts (white-labeled onboarding) --
  async ensureConnectAccount(userId: string, clientIp?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
      },
    });
    if (!user) throw new InternalServerErrorException('User not found');

    // If account already exists, update it with any missing information
    if (user.connectedAccountId) {
      // Update existing account with any missing required fields
      await this.updateConnectAccountWithRequiredFields(
        user.connectedAccountId,
        user,
        clientIp,
      );
      return { accountId: String(user.connectedAccountId) };
    }

    try {
      // Normalize user country to 2-letter ISO code
      let accountCountry = 'PT'; // Default fallback
      if (user.country) {
        const userCountryUpper = user.country.trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(userCountryUpper)) {
          accountCountry = userCountryUpper;
        } else {
          this.logger.warn(
            `[PaymentsService] User country "${user.country}" is not a 2-letter code, defaulting to PT`,
          );
          accountCountry = 'PT';
        }
      } else if (user.userProfile?.country) {
        const profileCountryUpper = user.userProfile.country
          .trim()
          .toUpperCase();
        if (/^[A-Z]{2}$/.test(profileCountryUpper)) {
          accountCountry = profileCountryUpper;
        }
      }

      this.logger.log(
        '[PaymentsService] Creating Connect account with country:',
        accountCountry,
      );

      // Build individual object with ALL available information from profile
      // This minimizes verification requirements by providing everything upfront
      const profile = user.userProfile;
      const individualData: any = {
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
      };

      // Always add phone if available
      if (user.phone) {
        individualData.phone = user.phone;
      }

      // Always add complete address if any part is available
      if (
        profile?.addressLine1 ||
        profile?.city ||
        profile?.postalCode ||
        profile?.country
      ) {
        individualData.address = {};
        if (profile.addressLine1)
          individualData.address.line1 = profile.addressLine1;
        if (profile.addressLine2)
          individualData.address.line2 = profile.addressLine2;
        if (profile.city) individualData.address.city = profile.city;
        if (profile.state) individualData.address.state = profile.state;
        if (profile.postalCode)
          individualData.address.postal_code = profile.postalCode;
        if (profile.country) {
          const profileCountryUpper = profile.country.trim().toUpperCase();
          if (/^[A-Z]{2}$/.test(profileCountryUpper)) {
            individualData.address.country = profileCountryUpper;
          } else {
            // Fallback to account country if profile country is invalid
            individualData.address.country = accountCountry;
          }
        } else {
          // Use account country as fallback
          individualData.address.country = accountCountry;
        }
      } else {
        // Even if no address in profile, set country to avoid requirement
        individualData.address = {
          country: accountCountry,
        };
      }

      // Always add date of birth if available
      if (profile?.dateOfBirth) {
        const dob = new Date(profile.dateOfBirth);
        individualData.dob = {
          day: dob.getDate(),
          month: dob.getMonth() + 1,
          year: dob.getFullYear(),
        };
      }

      // Get client IP for TOS acceptance (required by Stripe)
      const tosIp = clientIp || '0.0.0.0';

      // Create Custom account - platform controls everything
      // For individual accounts, we explicitly set business_profile to null to avoid business requirements
      const acct = await this.stripe.accounts.create({
        type: 'custom',
        email: user.email,
        country: accountCountry,
        metadata: { userId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: individualData,
        // Set minimal business_profile values for individual accounts to prevent Stripe requirements
        // Using placeholder values that don't require actual business information
        business_profile: {
          url: 'https://nasta.app', // Placeholder website - using platform URL
          mcc: '7372', // Generic MCC code for "Programming Services" - appropriate for service providers
        },
        // Accept TOS on behalf of the user (required for Connect accounts)
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: tosIp,
        },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { connectedAccountId: acct.id },
      });

      this.logger.log(
        '[PaymentsService] ✅ Stripe Connect account created:',
        acct.id,
      );
      return { accountId: acct.id };
    } catch (error: any) {
      if (error?.type === 'StripeInvalidRequestError') {
        if (error?.message?.includes('signed up for Connect')) {
          throw new BadRequestException(
            'Stripe Connect is not enabled on your account. Please enable it in your Stripe Dashboard: https://dashboard.stripe.com/settings/connect',
          );
        }
        if (
          error?.message?.includes('card_payments') ||
          error?.message?.includes('transfers')
        ) {
          throw new BadRequestException(
            error.message ||
              'Unable to create Connect account. Please ensure your country is set correctly in your profile settings.',
          );
        }
      }
      throw error;
    }
  }

  // Helper method to update existing Connect account with required fields
  // This method aggressively populates ALL available information to minimize verification requirements
  private async updateConnectAccountWithRequiredFields(
    accountId: string,
    user: any,
    clientIp?: string,
  ) {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      const profile = user.userProfile;
      const updateData: any = {};
      let needsUpdate = false;

      // Build complete individual object with all available information
      // We always rebuild it to ensure all fields are present, even if they exist
      updateData.individual = {};

      // Always set basic individual info
      if (user.firstName) updateData.individual.first_name = user.firstName;
      if (user.lastName) updateData.individual.last_name = user.lastName;
      if (user.email) updateData.individual.email = user.email;

      // Always add phone if available
      if (user.phone) {
        updateData.individual.phone = user.phone;
        needsUpdate = true;
      } else if (account.individual?.phone) {
        // Preserve existing phone if user doesn't have one
        updateData.individual.phone = account.individual.phone;
      }

      // Always build complete address if any part is available
      if (
        profile?.addressLine1 ||
        profile?.city ||
        profile?.postalCode ||
        profile?.country ||
        account.individual?.address
      ) {
        updateData.individual.address = {};

        // Use profile data if available, otherwise preserve existing
        updateData.individual.address.line1 =
          profile?.addressLine1 || account.individual?.address?.line1 || '';
        if (profile?.addressLine2)
          updateData.individual.address.line2 = profile.addressLine2;
        else if (account.individual?.address?.line2)
          updateData.individual.address.line2 =
            account.individual.address.line2;

        updateData.individual.address.city =
          profile?.city || account.individual?.address?.city || '';
        if (profile?.state) updateData.individual.address.state = profile.state;
        else if (account.individual?.address?.state)
          updateData.individual.address.state =
            account.individual.address.state;

        updateData.individual.address.postal_code =
          profile?.postalCode || account.individual?.address?.postal_code || '';

        // Country is required - use profile, existing, or account country
        if (profile?.country) {
          const profileCountryUpper = profile.country.trim().toUpperCase();
          if (/^[A-Z]{2}$/.test(profileCountryUpper)) {
            updateData.individual.address.country = profileCountryUpper;
          } else {
            updateData.individual.address.country = account.country || 'PT';
          }
        } else if (account.individual?.address?.country) {
          updateData.individual.address.country =
            account.individual.address.country;
        } else {
          updateData.individual.address.country = account.country || 'PT';
        }

        needsUpdate = true;
      }

      // Always add date of birth if available
      if (profile?.dateOfBirth) {
        const dob = new Date(profile.dateOfBirth);
        updateData.individual.dob = {
          day: dob.getDate(),
          month: dob.getMonth() + 1,
          year: dob.getFullYear(),
        };
        needsUpdate = true;
      } else if (account.individual?.dob) {
        // Preserve existing DOB if user doesn't have one
        updateData.individual.dob = account.individual.dob;
      }

      // Always ensure email is set
      if (user.email) {
        updateData.email = user.email;
        needsUpdate = true;
      }

      // For ALL individual accounts, set minimal business_profile values to prevent Stripe requirements
      // This applies to all users, not just those with current requirements
      // This is a workaround for Stripe's verification system that sometimes requires business_profile even for individuals
      if (account.business_type === 'individual') {
        // Always set business_profile for individual accounts to prevent future requirements
        // Use minimal placeholder values that don't require actual business information
        updateData.business_profile = {
          url: 'https://nasta.app', // Placeholder website - using platform URL
          mcc: '7372', // Generic MCC code for "Programming Services" - appropriate for service providers
        };
        needsUpdate = true;
        this.logger.log(
          '[PaymentsService] Setting minimal business_profile values for all individual accounts to prevent Stripe requirements',
        );
      }

      // ALWAYS ensure TOS is accepted (this is required by Stripe)
      const tosIp = clientIp || '0.0.0.0';
      updateData.tos_acceptance = {
        date: Math.floor(Date.now() / 1000),
        ip: tosIp,
      };
      needsUpdate = true;

      if (needsUpdate) {
        this.logger.log(
          '[PaymentsService] Updating Connect account with profile information:',
          {
            accountId: accountId.substring(0, 12) + '...',
            hasPhone: !!updateData.individual.phone,
            phoneValue: updateData.individual.phone,
            hasAddress: !!updateData.individual.address,
            addressDetails: updateData.individual.address
              ? {
                  line1: updateData.individual.address.line1,
                  city: updateData.individual.address.city,
                  postal_code: updateData.individual.address.postal_code,
                  country: updateData.individual.address.country,
                }
              : null,
            hasDOB: !!updateData.individual.dob,
            dobValue: updateData.individual.dob,
            hasEmail: !!updateData.email,
            businessProfileSet: !!updateData.business_profile,
            tosAccepted: !!updateData.tos_acceptance,
          },
        );

        await this.stripe.accounts.update(accountId, updateData);
        this.logger.log(
          '[PaymentsService] ✅ Updated Connect account with all available profile information:',
          accountId,
        );

        // Verify the update by retrieving the account again
        const updatedAccount = await this.stripe.accounts.retrieve(accountId);
        const remainingRequirements =
          updatedAccount.requirements?.currently_due || [];
        this.logger.log(
          '[PaymentsService] Remaining verification requirements after update:',
          {
            count: remainingRequirements.length,
            requirements: remainingRequirements,
            individualPhone: updatedAccount.individual?.phone,
            individualAddress: updatedAccount.individual?.address
              ? {
                  line1: updatedAccount.individual.address.line1,
                  city: updatedAccount.individual.address.city,
                  postal_code: updatedAccount.individual.address.postal_code,
                  country: updatedAccount.individual.address.country,
                }
              : null,
            individualDOB: updatedAccount.individual?.dob,
            tosAccepted: updatedAccount.tos_acceptance?.date ? 'Yes' : 'No',
            businessProfile: updatedAccount.business_profile,
          },
        );

        // If all requirements are met but payouts are still disabled, try to request a review
        // This helps Stripe process the account faster
        if (
          remainingRequirements.length === 0 &&
          !updatedAccount.payouts_enabled &&
          updatedAccount.requirements?.disabled_reason === 'listed'
        ) {
          try {
            this.logger.log(
              '[PaymentsService] All requirements met but payouts disabled. Requesting account review...',
            );
            // Request a review - this tells Stripe the account is ready for verification
            await this.stripe.accounts.update(accountId, {
              tos_acceptance: {
                date: Math.floor(Date.now() / 1000),
                ip: clientIp || '0.0.0.0',
              },
            });
            this.logger.log(
              '[PaymentsService] ✅ Account review requested. Stripe will process the account shortly.',
            );
          } catch (reviewError: any) {
            this.logger.warn(
              '[PaymentsService] Could not request account review:',
              reviewError?.message,
            );
            // This is not critical - Stripe will eventually process the account automatically
          }
        }
      }
    } catch (error: any) {
      this.logger.error(
        '[PaymentsService] Error updating Connect account:',
        error?.message,
      );
      this.logger.error('[PaymentsService] Error details:', {
        type: error?.type,
        code: error?.code,
        param: error?.param,
      });
      // Don't throw - this is a best-effort update
    }
  }

  // For Custom accounts, we don't use account links - we collect info directly
  createAccountOnboardingLink(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: {
      refreshUrl: string;
      returnUrl: string;
      state?: string;
    },
  ) {
    // This method is kept for backward compatibility but won't be used for Custom accounts
    // Custom accounts use updateBankAccount instead
    throw new BadRequestException(
      'Custom accounts do not use onboarding links. Please use the bank account form instead.',
    );
  }

  // Update bank account for Custom accounts
  async updateBankAccount(
    userId: string,
    bankDetails: {
      accountHolderName: string;
      accountNumber?: string;
      routingNumber?: string;
      country: string;
      currency: string;
      accountHolderType?: 'individual' | 'company';
      iban?: string;
      swift?: string;
    },
    clientIp?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userProfile: true },
    });
    if (!user) throw new InternalServerErrorException('User not found');

    // Ensure account exists and is fully populated with profile info BEFORE adding bank account
    // This minimizes verification requirements by having everything ready upfront
    const ensured = await this.ensureConnectAccount(userId, clientIp);
    const accountId = ensured.accountId;

    // Aggressively update account with ALL available profile information before bank account addition
    // This ensures the account is as complete as possible, reducing Stripe's verification requirements
    await this.updateConnectAccountWithRequiredFields(
      accountId,
      user,
      clientIp,
    );

    try {
      // Validate country code - must be exactly 2 uppercase letters
      this.logger.log(
        '[PaymentsService] updateBankAccount - Received country:',
        bankDetails.country,
        'Type:',
        typeof bankDetails.country,
      );

      if (!bankDetails.country || typeof bankDetails.country !== 'string') {
        throw new BadRequestException(
          `Invalid country: "${bankDetails.country}". Country must be a 2-letter ISO code.`,
        );
      }

      const countryCode = bankDetails.country.trim().toUpperCase();
      this.logger.log(
        '[PaymentsService] updateBankAccount - Normalized country:',
        countryCode,
        'Length:',
        countryCode.length,
      );

      if (countryCode.length !== 2 || !/^[A-Z]{2}$/.test(countryCode)) {
        this.logger.error(
          '[PaymentsService] Invalid country code format:',
          countryCode,
        );
        throw new BadRequestException(
          `Invalid country code: "${bankDetails.country}". Country must be a 2-letter ISO code (e.g., PT, DE, FR, LT).`,
        );
      }

      // Build external account object based on whether IBAN or account/routing is provided
      // CRITICAL: Ensure country is always a 2-letter ISO code (never a country name)
      const externalAccountData: any = {
        object: 'bank_account',
        country: countryCode, // Use validated 2-letter ISO code (e.g., "LT", "PT", "DE")
        currency: bankDetails.currency.toLowerCase(),
        account_holder_name: bankDetails.accountHolderName,
        account_holder_type: bankDetails.accountHolderType || 'individual',
      };

      // Final safety check - ensure country is exactly 2 uppercase letters
      if (
        externalAccountData.country !== countryCode ||
        !/^[A-Z]{2}$/.test(externalAccountData.country)
      ) {
        this.logger.error(
          '[PaymentsService] CRITICAL ERROR: Country mismatch in externalAccountData!',
          {
            expected: countryCode,
            actual: externalAccountData.country,
            type: typeof externalAccountData.country,
          },
        );
        throw new BadRequestException(
          `Internal error: Country code validation failed. Expected "${countryCode}", got "${externalAccountData.country}"`,
        );
      }

      // For EU/international accounts, use IBAN
      // Stripe's createExternalAccount API expects account_number for European accounts
      // The IBAN itself is used as the account_number for European bank accounts
      if (bankDetails.iban) {
        const cleanedIban = bankDetails.iban.replace(/\s/g, '').toUpperCase(); // Remove spaces and uppercase
        this.logger.log('[PaymentsService] IBAN processing:', {
          original: bankDetails.iban,
          cleaned: cleanedIban,
          length: cleanedIban.length,
          country: countryCode,
          startsWithCountry: cleanedIban.startsWith(countryCode),
        });

        // Basic IBAN validation
        if (cleanedIban.length < 15 || cleanedIban.length > 34) {
          throw new BadRequestException(
            `Invalid IBAN length: ${cleanedIban.length}. IBAN must be between 15 and 34 characters.`,
          );
        }

        if (!cleanedIban.startsWith(countryCode)) {
          throw new BadRequestException(
            `IBAN must start with the country code "${countryCode}". Received IBAN starting with "${cleanedIban.substring(0, 2)}".`,
          );
        }

        if (!/^[A-Z0-9]+$/.test(cleanedIban)) {
          throw new BadRequestException(
            'IBAN can only contain letters and numbers.',
          );
        }

        // For Stripe Connect Custom accounts with European IBAN accounts
        // Use account_number field with the IBAN value (Stripe's standard approach)
        externalAccountData.account_number = cleanedIban;
      } else if (bankDetails.routingNumber && bankDetails.accountNumber) {
        // For US accounts, use routing_number and account_number
        externalAccountData.routing_number = bankDetails.routingNumber;
        externalAccountData.account_number = bankDetails.accountNumber;
      } else {
        throw new BadRequestException(
          'Either IBAN or both account number and routing number are required',
        );
      }

      // Log exactly what we're sending to Stripe
      this.logger.log(
        '[PaymentsService] Sending to Stripe createExternalAccount:',
        {
          accountId,
          externalAccountData: {
            ...externalAccountData,
            iban: externalAccountData.iban
              ? `${externalAccountData.iban.substring(0, 4)}...`
              : undefined,
          },
          countryInData: externalAccountData.country,
          countryType: typeof externalAccountData.country,
          countryLength: externalAccountData.country?.length,
          countryMatches: /^[A-Z]{2}$/.test(externalAccountData.country || ''),
        },
      );

      // Double-check country is a valid 2-letter code before sending to Stripe
      if (
        !externalAccountData.country ||
        !/^[A-Z]{2}$/.test(externalAccountData.country)
      ) {
        this.logger.error(
          '[PaymentsService] CRITICAL: Invalid country code before Stripe call:',
          externalAccountData.country,
        );
        throw new BadRequestException(
          `Invalid country code "${externalAccountData.country}" being sent to Stripe. Expected 2-letter ISO code.`,
        );
      }

      // Create external account (bank account) for the connected account
      // This should be AUTOMATIC - no manual creation needed in Stripe Dashboard
      let externalAccount;
      try {
        // For European IBAN accounts in Stripe Connect Custom accounts:
        // - Use account_number field with the IBAN value
        // - Stripe will automatically create the bank account in the Connect account
        this.logger.log(
          '[PaymentsService] Creating external account (AUTOMATIC - no manual setup needed):',
          {
            accountId: accountId.substring(0, 12) + '...',
            country: externalAccountData.country,
            currency: externalAccountData.currency,
            account_number_length: externalAccountData.account_number?.length,
          },
        );

        externalAccount = await this.stripe.accounts.createExternalAccount(
          accountId,
          {
            external_account: externalAccountData,
          },
        );

        this.logger.log(
          '[PaymentsService] ✅ Bank account AUTOMATICALLY created in Stripe:',
          {
            externalAccountId: externalAccount.id,
            object: externalAccount.object,
            country: externalAccount.country,
            currency: externalAccount.currency,
            bank_name: externalAccount.bank_name,
            last4: externalAccount.last4,
            status: externalAccount.status,
            account_holder_name: externalAccount.account_holder_name,
            account_holder_type: externalAccount.account_holder_type,
            default_for_currency: externalAccount.default_for_currency,
            note: 'This bank account is now visible in Stripe Dashboard under Connect > Accounts > External Accounts',
          },
        );

        // Verify the bank account was actually created by retrieving it
        try {
          const verifyAccount =
            await this.stripe.accounts.retrieveExternalAccount(
              accountId,
              externalAccount.id,
            );
          this.logger.log(
            '[PaymentsService] ✅ Verified bank account exists in Stripe:',
            {
              id: verifyAccount.id,
              object: verifyAccount.object,
              status:
                verifyAccount.object === 'bank_account'
                  ? (verifyAccount as any).status
                  : undefined,
              bank_name:
                verifyAccount.object === 'bank_account'
                  ? (verifyAccount as any).bank_name
                  : undefined,
            },
          );
        } catch (verifyError: any) {
          this.logger.error(
            '[PaymentsService] ⚠️ WARNING: Could not verify bank account after creation:',
            verifyError?.message,
          );
        }
      } catch (stripeError: any) {
        this.logger.error('[PaymentsService] Stripe error details:', {
          type: stripeError?.type,
          message: stripeError?.message,
          code: stripeError?.code,
          param: stripeError?.param,
          rawError: JSON.stringify(stripeError, null, 2),
          requestData: {
            country: externalAccountData.country,
            object: externalAccountData.object,
            iban: externalAccountData.iban
              ? `${externalAccountData.iban.substring(0, 4)}...${externalAccountData.iban.substring(externalAccountData.iban.length - 4)}`
              : undefined,
            ibanLength: externalAccountData.iban?.length,
          },
        });
        throw stripeError;
      }

      // Set as default payout method for this currency
      // For Custom accounts, we need to set default_for_currency on the external account itself
      try {
        // First, try to set it as default via the external account update
        await this.stripe.accounts.updateExternalAccount(
          accountId,
          externalAccount.id,
          {
            default_for_currency: true,
          },
        );
        this.logger.log(
          '[PaymentsService] ✅ Set bank account as default for currency:',
          bankDetails.currency,
        );
      } catch (defaultError: any) {
        this.logger.warn(
          '[PaymentsService] Could not set bank account as default:',
          defaultError?.message,
        );
        // Fallback: update account default currency
        await this.stripe.accounts.update(accountId, {
          default_currency: bankDetails.currency.toLowerCase(),
        });
      }

      // Verify the bank account is actually visible in Stripe by listing external accounts
      try {
        const verifyList = await this.stripe.accounts.listExternalAccounts(
          accountId,
          {
            object: 'bank_account',
            limit: 10,
          },
        );
        const foundAccount = verifyList.data.find(
          (acc: any) => acc.id === externalAccount.id,
        );
        if (foundAccount) {
          const isBankAccount = foundAccount.object === 'bank_account';
          this.logger.log(
            '[PaymentsService] ✅ Verified bank account is visible in Stripe external accounts list:',
            {
              id: foundAccount.id,
              object: foundAccount.object,
              bank_name: isBankAccount
                ? (foundAccount as any).bank_name
                : undefined,
              last4: isBankAccount ? (foundAccount as any).last4 : undefined,
              status: isBankAccount ? (foundAccount as any).status : undefined,
              totalAccounts: verifyList.data.length,
            },
          );
        } else {
          this.logger.error(
            '[PaymentsService] ⚠️ WARNING: Bank account was created but not found in external accounts list!',
          );
        }
      } catch (verifyError: any) {
        this.logger.error(
          '[PaymentsService] ⚠️ WARNING: Could not verify bank account in list:',
          verifyError?.message,
        );
      }

      // After adding bank account, automatically update account with any missing required fields
      // This will fill in address, phone, DOB, TOS acceptance, and remove business_profile requirements
      await this.updateConnectAccountWithRequiredFields(
        accountId,
        user,
        clientIp,
      );

      // Update account to request capabilities if not already enabled
      // For Custom accounts, we ensure capabilities are requested
      // Note: We check if capabilities are strings equal to 'active', otherwise request them
      const account = await this.stripe.accounts.retrieve(accountId);
      const transfersCap = account.capabilities?.transfers;
      const cardPaymentsCap = account.capabilities?.card_payments;

      // Type-safe check: capabilities can be string 'active' or other values/objects
      const transfersActive =
        typeof transfersCap === 'string' && transfersCap === 'active';
      const cardPaymentsActive =
        typeof cardPaymentsCap === 'string' && cardPaymentsCap === 'active';

      if (!transfersActive || !cardPaymentsActive) {
        await this.stripe.accounts.update(accountId, {
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true },
          },
        });
      }

      // Return detailed information about the created bank account
      return {
        success: true,
        externalAccountId: externalAccount.id,
        bankAccount: {
          id: externalAccount.id,
          bankName: externalAccount.bank_name,
          last4: externalAccount.last4,
          country: externalAccount.country,
          currency: externalAccount.currency,
          status: externalAccount.status,
          accountHolderName: externalAccount.account_holder_name,
          defaultForCurrency: externalAccount.default_for_currency,
        },
        message: 'Bank account added successfully',
        note: 'The bank account is now visible in Stripe Dashboard. Go to Connect > Accounts > [Your Account] > External accounts to view it.',
      };
    } catch (error: any) {
      this.logger.error('Error updating bank account:', error);

      // Handle Stripe-specific errors
      if (error?.type === 'StripeInvalidRequestError') {
        let errorMessage =
          error.message ||
          'Failed to add bank account. Please check your details and try again.';

        this.logger.error('[PaymentsService] Stripe validation error:', {
          message: error.message,
          code: error.code,
          param: error.param,
          type: error.type,
        });

        // Provide user-friendly messages for common Stripe errors
        if (
          errorMessage.includes('country') ||
          errorMessage.includes('Country')
        ) {
          errorMessage = `Invalid country code. Please use a 2-letter ISO country code (e.g., PT, DE, FR, LT). Received: "${bankDetails.country}"`;
        } else if (
          errorMessage.includes('iban') ||
          errorMessage.includes('IBAN')
        ) {
          // Show more specific error if available
          if (
            error.param === 'iban' ||
            error.code === 'parameter_invalid_string'
          ) {
            errorMessage = `Invalid IBAN format: ${error.message || 'Please check your IBAN and try again.'}`;
          } else {
            errorMessage = `Invalid IBAN: ${error.message || 'Please check your IBAN format and try again.'}`;
          }
        } else if (
          errorMessage.includes('account_number') ||
          errorMessage.includes('routing_number')
        ) {
          errorMessage =
            'Invalid account or routing number. Please check your details and try again.';
        }

        throw new BadRequestException(errorMessage);
      }

      // Re-throw other errors
      throw error;
    }
  }

  // -- Booking manual capture flow --
  async authorizeBookingHold(
    employerId: string,
    bookingId: string,
    dto: AuthorizeHoldDto,
  ): Promise<{ paymentIntentId: string; clientSecret: string | null }> {
    // Validate booking and ownership
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { job: true, jobSeeker: true },
    });
    if (!booking) throw new InternalServerErrorException('Booking not found');
    const full = booking as unknown as {
      id: string;
      currency: string | null;
      agreedCurrency: string | null;
      agreedRateAmount: number | null;
      agreedPayUnit: PaymentType | null;
      approvedUnits: number | null;
      holdIntentId: string | null;
      jobSeekerId: string;
      jobId: string | null;
      employerId: string | null;
      job: {
        employerId: string;
        currency: string;
        rateAmount: number | null;
        paymentType: PaymentType;
      } | null;
      jobSeeker: { connectedAccountId: string | null };
      holdAmount: number | null;
    };
    const ownerEmployerId = full.job ? full.job.employerId : full.employerId;
    if (!ownerEmployerId || ownerEmployerId !== employerId) {
      throw new InternalServerErrorException(
        'Not authorized to authorize this booking',
      );
    }
    const destination = full.jobSeeker.connectedAccountId ?? undefined;
    if (!destination) {
      throw new InternalServerErrorException(
        'Job seeker is not onboarded for payouts',
      );
    }

    const currency: string =
      dto.currency ??
      full.agreedCurrency ??
      full.currency ??
      full.job?.currency ??
      'EUR';
    const amount = dto.amount;
    const applicationFee = this.computePlatformFee(amount);

    // Idempotency: if a hold already exists for this booking with same amount, return it
    if (full.holdIntentId && full.holdAmount === amount) {
      const existing = await this.stripe.paymentIntents.retrieve(
        full.holdIntentId,
      );
      return {
        paymentIntentId: existing.id,
        clientSecret: existing.client_secret,
      };
    }

    const statementDescriptor = this.config
      .get<string>('STRIPE_STATEMENT_DESCRIPTOR')
      ?.slice(0, 22);

    const intent = await this.stripe.paymentIntents.create(
      {
        amount,
        currency,
        capture_method: 'manual',
        application_fee_amount: applicationFee,
        transfer_data: { destination },
        payment_method_options: {
          card: { request_three_d_secure: 'automatic' },
        },
        ...(statementDescriptor && {
          statement_descriptor_suffix: statementDescriptor,
        }),
        metadata: {
          bookingId,
          employerId,
          seekerId: booking.jobSeekerId,
          jobId: booking.jobId ?? undefined,
        },
      },
      { idempotencyKey: `booking_auth_${bookingId}_${amount}` },
    );

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { holdIntentId: intent.id, holdAmount: amount },
    });

    return { paymentIntentId: intent.id, clientSecret: intent.client_secret };
  }

  async captureBookingPayment(
    employerId: string,
    bookingId: string,
    dto: CaptureBookingDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { job: true },
    });
    if (!booking) throw new InternalServerErrorException('Booking not found');
    const full = booking as unknown as {
      id: string;
      approvedUnits: number | null;
      agreedRateAmount: number | null;
      agreedPayUnit: PaymentType | null;
      holdIntentId: string | null;
      employerId: string | null;
      job: {
        employerId: string;
        rateAmount: number | null;
        paymentType: PaymentType;
      } | null;
    };
    const ownerEmployerId = full.job ? full.job.employerId : full.employerId;
    if (!ownerEmployerId || ownerEmployerId !== employerId) {
      throw new InternalServerErrorException(
        'Not authorized to capture this booking',
      );
    }
    if (!full.holdIntentId) {
      throw new InternalServerErrorException('No hold to capture');
    }

    const finalAmount = this.computeFinalAmount(
      full,
      full.job ?? { rateAmount: null, paymentType: PaymentType.HOURLY },
      dto,
    );
    const intent = await this.stripe.paymentIntents.capture(
      full.holdIntentId,
      {
        amount_to_capture: finalAmount,
        application_fee_amount: this.computePlatformFee(finalAmount),
      },
      { idempotencyKey: `booking_capture_${bookingId}_${finalAmount}` },
    );

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        capturedAmount: finalAmount,
        capturedAt: new Date(),
        finalAmount,
      },
    });

    return {
      captured: true,
      chargeId: (intent.latest_charge as string) ?? null,
    };
  }

  /**
   * Capture paid amount as platform revenue (non-refundable)
   * Used when job is reset due to incomplete payment
   * The amount goes to the platform, not the service provider
   */
  async capturePaidAmountAsPlatformRevenue(
    applicationId: string,
    paymentId: string,
    amount: number,
    reason: string,
  ): Promise<void> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          stripePaymentIntentId: true,
          status: true,
          currency: true,
        },
      });

      if (!payment || !payment.stripePaymentIntentId) {
        this.logger.warn(
          `Cannot capture as platform revenue: payment ${paymentId} has no payment intent`,
        );
        return;
      }

      // Retrieve payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId,
      );

      // If payment is not yet captured, capture it first
      if (paymentIntent.status === 'requires_capture') {
        try {
          await this.stripe.paymentIntents.capture(
            payment.stripePaymentIntentId,
            {
              amount_to_capture: paymentIntent.amount,
            },
          );
          this.logger.log(
            `Captured payment intent ${paymentIntent.id} before platform revenue capture`,
          );
        } catch (err: unknown) {
          // If already captured, that's fine
          const error = err as StripeError & { code?: string };
          if (error?.code !== 'payment_intent_unexpected_state') {
            this.logger.warn(
              `Failed to capture payment intent: ${error?.message || 'Unknown error'}`,
            );
          }
        }
      }

      // Update payment record to mark as platform revenue (non-refundable)
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatusDb.SUCCEEDED,
          // Add metadata to indicate this is platform revenue
          metadata: {
            platformRevenue: true,
            nonRefundable: true,
            reason: reason,
            capturedAt: new Date().toISOString(),
            applicationId: applicationId,
          } as any,
        },
      });

      this.logger.log(
        `Captured paid amount ${amount} as platform revenue (non-refundable) for application ${applicationId}. Reason: ${reason}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to capture paid amount as platform revenue: ${err}`,
      );
      throw err;
    }
  }

  /**
   * Verify that all selected services and accepted negotiations are fully paid
   * Returns true if all amounts are paid, false otherwise
   */
  async verifyAllPaymentsComplete(applicationId: string): Promise<{
    allPaid: boolean;
    unpaidAmount: number;
    message: string;
  }> {
    const paymentCheck = await this.checkApplicationPayment(applicationId);

    if (!paymentCheck.paymentRequired) {
      return {
        allPaid: false,
        unpaidAmount: 0,
        message:
          'No payment has been initiated. Please complete payment first.',
      };
    }

    const unpaidAmount = paymentCheck.unpaidAmount || 0;

    if (unpaidAmount > 0.01) {
      // Allow small rounding differences
      return {
        allPaid: false,
        unpaidAmount,
        message: `Payment incomplete. You have an unpaid amount of ${paymentCheck.unpaidAmount?.toFixed(2) || '0.00'}. All selected services and accepted negotiations must be fully paid before the service provider is obligated to perform the work.`,
      };
    }

    return {
      allPaid: true,
      unpaidAmount: 0,
      message: 'All payments are complete.',
    };
  }

  /**
   * Mark application as complete and capture payment
   * This releases the held payment to the service provider
   */
  async completeApplicationPayment(employerId: string, applicationId: string) {
    // Get application with payment details and service provider's Connect account
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            employerId: true,
            title: true,
            status: true,
          },
        },
        payment: true,
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            connectedAccountId: true,
          },
        },
      },
    });

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    if (application.job.employerId !== employerId) {
      throw new ForbiddenException(
        'You can only complete your own applications',
      );
    }

    // CRITICAL: Verify all payments are complete before allowing job completion
    const paymentVerification =
      await this.verifyAllPaymentsComplete(applicationId);
    if (!paymentVerification.allPaid) {
      throw new BadRequestException(
        `Cannot complete job: ${paymentVerification.message} The selected services must be paid, or otherwise the service provider is not obligated to perform those services. Any amount that was agreed on during negotiation and set to accept by any of the both sides must be paid, or the amount that was paid at the beginning to accept the job will be deducted and will not be refundable, and we will need to reset the job to the old status and reset it to new until the full amount that was agreed on or added to the selected services is paid.`,
      );
    }

    // If already completed, just sync the booking (don't throw error)
    if (application.completedAt) {
      this.logger.log(
        `Application ${applicationId} is already completed. Reconciling payment and syncing booking...`,
      );

      // Reconcile payment record before syncing — the stored PI/session may
      // have been overwritten by an abandoned checkout while the real payment
      // succeeded in Stripe.
      await this.reconcilePaymentRecord(applicationId);

      // Still proceed to sync booking, but skip payment capture
      await this.syncBookingForCompletedApplication(applicationId);

      // Best-effort: if receipt emails were missed, try again (idempotent).
      try {
        const employer = await this.prisma.user.findUnique({
          where: { id: application.job.employerId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });

        const paymentStatus = await this.checkApplicationPayment(applicationId);
        const totalPaidAmountInCents = Math.round(
          (paymentStatus.paidAmount || 0) * 100,
        );
        const totalAmount =
          totalPaidAmountInCents > 0
            ? totalPaidAmountInCents
            : application.payment?.amount || 0;
        const platformFee = Math.round(
          totalAmount * this.getPlatformFeeFraction(),
        );
        const serviceProviderAmount = Math.max(0, totalAmount - platformFee);

        const booking = await this.prisma.booking.findFirst({
          where: {
            jobId: application.job.id,
            jobSeekerId: application.applicant.id,
          },
          select: { stripeTransferId: true },
        });

        await this.sendReceiptEmails(
          applicationId,
          application,
          employer,
          totalAmount / 100,
          serviceProviderAmount / 100,
          platformFee / 100,
          (application.payment?.currency || 'EUR').toUpperCase(),
          booking?.stripeTransferId || null,
          application.completedAt,
          { sendEmployer: true, sendServiceProvider: true },
        );
      } catch (receiptRetryError) {
        this.logger.warn(
          `Failed to re-attempt receipt emails for already-completed application ${applicationId}: ${receiptRetryError}`,
        );
      }
      throw new BadRequestException(
        'This job has already been marked as complete. Booking has been synced.',
      );
    }

    if (!application.payment) {
      throw new BadRequestException(
        'No payment found for this application. Payment must be completed before marking the job as done.',
      );
    }

    // The stored stripePaymentIntentId may be null if the employer started checkout but
    // abandoned it, then paid successfully with a new checkout session.
    // In that case, Stripe still has the completed PI (matched by customer+applicationId metadata).
    // We resolve the actual PI from Stripe before giving up.
    let resolvedPaymentIntentId = application.payment.stripePaymentIntentId;

    if (!resolvedPaymentIntentId) {
      // Scan Stripe for a completed PI matching this application (same logic as checkApplicationPayment)
      try {
        const { customerId } = await this.ensureCustomer(
          application.payment.userId,
        );
        const list = await this.stripe.paymentIntents.list({
          customer: customerId,
          limit: 50,
        });
        const completedPi = (list.data || [])
          .filter((pi) => {
            const md = pi.metadata || {};
            return (
              md.applicationId === applicationId &&
              (md.type === 'application_payment' || md.type === undefined)
            );
          })
          .filter(
            (pi) =>
              pi.status === 'succeeded' || pi.status === 'requires_capture',
          )
          .sort((a, b) => (b.created || 0) - (a.created || 0))[0];

        if (completedPi) {
          resolvedPaymentIntentId = completedPi.id;
          this.logger.log(
            `[completeApplicationPayment] Stored PI was null for application ${applicationId}. ` +
              `Resolved actual completed PI from Stripe: ${completedPi.id} (status: ${completedPi.status})`,
          );
          // Update the Payment record so future lookups don't need this scan
          await this.prisma.payment.update({
            where: { id: application.payment.id },
            data: { stripePaymentIntentId: completedPi.id },
          });
        }
      } catch (scanErr) {
        this.logger.warn(
          `[completeApplicationPayment] Failed to scan Stripe for PI: ${scanErr}`,
        );
      }
    }

    if (!resolvedPaymentIntentId) {
      throw new BadRequestException(
        'No payment intent found. The payment checkout was not completed. Please complete the payment first.',
      );
    }

    // Retrieve payment intent to check status
    let paymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.retrieve(
        resolvedPaymentIntentId,
      );
    } catch (err) {
      throw new BadRequestException('Failed to retrieve payment intent');
    }

    // Check if payment was already captured as platform revenue (non-refundable)
    // If so, don't transfer to service provider
    const paymentMetadata = application.payment.metadata as any;
    const isPlatformRevenue =
      paymentMetadata?.platformRevenue === true ||
      paymentMetadata?.nonRefundable === true;

    if (isPlatformRevenue) {
      this.logger.log(
        `Payment for application ${applicationId} was already captured as platform revenue. Skipping transfer to service provider.`,
      );
      // Mark as completed but don't transfer
      const completedAtDate = new Date();
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          completedAt: completedAtDate,
        },
      });
      await this.prisma.job.update({
        where: { id: application.job.id },
        data: { status: 'COMPLETED' },
      });

      // Lock chat conversations for completed job
      try {
        await this.chatService.lockConversationsByJobId(application.job.id);
      } catch (chatErr) {
        this.logger.warn(
          `[Chat] Failed to lock conversations for platform-revenue job ${application.job.id}: ${chatErr}`,
        );
      }

      // Employer receipt is still crucial even in platform-revenue cases.
      try {
        const employer = await this.prisma.user.findUnique({
          where: { id: application.job.employerId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });

        const paymentStatus = await this.checkApplicationPayment(applicationId);
        const totalPaidAmountInCents = Math.round(
          (paymentStatus.paidAmount || 0) * 100,
        );
        const totalAmount =
          totalPaidAmountInCents > 0
            ? totalPaidAmountInCents
            : application.payment?.amount || paymentIntent.amount;

        await this.sendReceiptEmails(
          applicationId,
          application,
          employer,
          totalAmount / 100,
          0,
          totalAmount / 100,
          (
            application.payment?.currency ||
            paymentIntent.currency ||
            'EUR'
          ).toUpperCase(),
          null,
          completedAtDate,
          { sendEmployer: true, sendServiceProvider: false },
        );
      } catch (receiptError) {
        this.logger.warn(
          `Failed to send employer receipt for platform-revenue completion (${applicationId}): ${receiptError}`,
        );
      }
      return {
        completed: true,
        completedAt: completedAtDate.toISOString(),
        message:
          'Application completed - payment was captured as platform revenue (non-refundable)',
        chargeId: (paymentIntent.latest_charge as string) ?? null,
        platformRevenue: true,
      };
    }

    // Calculate platform fee (10%) and service provider amount (90%).
    // Stripe is the source of truth: use cumulative paid amount (across all intents) so completion
    // and receipts stay correct even after additional payments reset the stored PI id.
    const paymentStatus = await this.checkApplicationPayment(applicationId);
    const totalPaidAmountInCents = Math.round(
      (paymentStatus.paidAmount || 0) * 100,
    );

    // Fallback: keep prior behavior if for some reason Stripe-paid total couldn't be derived.
    const totalAmount =
      totalPaidAmountInCents > 0
        ? totalPaidAmountInCents
        : application.payment.amount || paymentIntent.amount;

    const platformFee = Math.round(totalAmount * this.getPlatformFeeFraction());
    const serviceProviderAmount = Math.max(0, totalAmount - platformFee);

    this.logger.log(
      `Calculating transfer for application ${applicationId}: totalAmount=${totalAmount} cents (€${(totalAmount / 100).toFixed(2)}), platformFee=${platformFee} cents (€${(platformFee / 100).toFixed(2)}), serviceProviderAmount=${serviceProviderAmount} cents (€${(serviceProviderAmount / 100).toFixed(2)})`,
    );

    // Check if payment is already captured
    let capturedIntent = paymentIntent;
    if (paymentIntent.status === 'requires_capture') {
      // Only capture if payment is in requires_capture state
      try {
        // Use UUID-based idempotency key to avoid conflicts on retries
        const idempotencyKey = `capture_${applicationId}_${randomUUID()}`;
        capturedIntent = await this.stripe.paymentIntents.capture(
          resolvedPaymentIntentId,
          {
            // Never attempt to capture more than the intent's amount.
            amount_to_capture: Math.min(totalAmount, paymentIntent.amount),
          },
          {
            idempotencyKey: idempotencyKey,
          },
        );
        this.logger.log(
          `Payment captured for application ${applicationId}: ${capturedIntent.id}`,
        );
      } catch (err: unknown) {
        const stripeError = err as StripeError & {
          code?: string;
          payment_intent?: { status?: string };
        };
        this.logger.error('[PaymentsService] Error capturing payment:', {
          code: stripeError?.code,
          message: stripeError?.message,
          type: stripeError?.type,
        });

        // Handle idempotency errors - if payment was already captured, use existing intent
        if (stripeError?.type === 'StripeIdempotencyError') {
          // Retry without idempotency key, or check status again
          try {
            const retryIntent = await this.stripe.paymentIntents.retrieve(
              resolvedPaymentIntentId,
            );
            if (retryIntent.status === 'succeeded') {
              capturedIntent = retryIntent;
              this.logger.log(
                `Payment already captured for application ${applicationId} (idempotency conflict resolved)`,
              );
            } else {
              // Try capture again without idempotency key
              capturedIntent = await this.stripe.paymentIntents.capture(
                resolvedPaymentIntentId,
                {
                  amount_to_capture: totalAmount,
                },
              );
              this.logger.log(
                `Payment captured on retry for application ${applicationId}: ${capturedIntent.id}`,
              );
            }
          } catch (retryErr: unknown) {
            const retryError = retryErr as StripeError;
            throw new BadRequestException(
              `Failed to capture payment: ${retryError?.message || 'Unknown error'}`,
            );
          }
        } else if (stripeError?.code === 'payment_intent_unexpected_state') {
          // Payment might already be captured
          if (stripeError.payment_intent?.status === 'succeeded') {
            capturedIntent = stripeError.payment_intent as Stripe.PaymentIntent;
            this.logger.log(
              `Payment already captured for application ${applicationId}, using existing intent`,
            );
          } else {
            throw new BadRequestException(
              `Cannot capture payment: ${stripeError?.message || 'Unknown error'}`,
            );
          }
        } else {
          throw new BadRequestException(
            `Failed to capture payment: ${stripeError?.message || 'Unknown error'}`,
          );
        }
      }
    } else if (paymentIntent.status === 'succeeded') {
      this.logger.log(
        `Payment already captured for application ${applicationId}, skipping capture step`,
      );
    } else {
      throw new BadRequestException(
        `Payment intent is in ${paymentIntent.status} state and cannot be captured.`,
      );
    }

    // Transfer funds to service provider's Connect account
    // If there were multiple payments, a single source charge is insufficient.
    // Prefer a single balance-funded transfer; if that fails, fall back to per-charge transfers.
    let transferId: string | null = null;
    let transferIdsForNotes: string[] = [];

    if (serviceProviderAmount > 0) {
      try {
        const ensured = await this.ensureConnectAccount(
          application.applicant.id,
        );
        const serviceProviderAccountId = ensured.accountId;

        if (!serviceProviderAccountId) {
          this.logger.error(
            `❌ Could not get Connect account for service provider ${application.applicant.id}, skipping transfer`,
          );
        } else {
          // Attempt a single transfer from platform balance (works for cumulative totals).
          try {
            const transfer = await this.stripe.transfers.create(
              {
                amount: serviceProviderAmount,
                currency: paymentIntent.currency.toLowerCase(),
                destination: serviceProviderAccountId,
                metadata: {
                  applicationId: applicationId,
                  jobId: application.job.id,
                  type: 'application_completion',
                  transferMode: 'balance',
                },
              },
              {
                idempotencyKey: `xfer_${applicationId}_total_${serviceProviderAmount}`,
              },
            );

            transferId = transfer.id;
            transferIdsForNotes = [transfer.id];
            this.logger.log(
              `✅ Transfer (balance) created successfully for application ${applicationId}: ${transferId}. Amount: ${serviceProviderAmount} cents (€${(serviceProviderAmount / 100).toFixed(2)}).`,
            );
          } catch (balanceTransferError: unknown) {
            const error = balanceTransferError as StripeError;
            this.logger.warn(
              `⚠️ Balance transfer failed for application ${applicationId} (${error?.code || 'unknown'}). Falling back to per-charge transfers...`,
            );

            // Fall back to per-charge transfers (source_transaction) so the provider still gets paid.
            const { customerId } = await this.ensureCustomer(employerId);
            const list = await this.stripe.paymentIntents.list({
              customer: customerId,
              limit: 50,
              expand: ['data.latest_charge'],
            });

            const appIntents = (list.data || [])
              .filter((pi) => {
                const md = pi.metadata || {};
                return (
                  md.applicationId === applicationId &&
                  (md.type === 'application_payment' || md.type === undefined)
                );
              })
              .filter((pi) => {
                if (
                  pi.status === 'succeeded' ||
                  pi.status === 'requires_capture'
                ) {
                  return true;
                }
                if (pi.status === 'processing') {
                  const received =
                    typeof pi.amount_received === 'number'
                      ? pi.amount_received
                      : 0;
                  return received > 0;
                }
                return false;
              })
              .slice()
              .sort((a, b) => (a.created || 0) - (b.created || 0));

            if (appIntents.length === 0) {
              throw new Error(
                `No completed payment intents found for application ${applicationId}`,
              );
            }

            const intentAmountsInCents = appIntents.map((pi) => {
              if (pi.status === 'requires_capture') {
                return pi.amount ? Math.round(pi.amount) : 0;
              }
              const received =
                typeof pi.amount_received === 'number'
                  ? Math.round(pi.amount_received)
                  : 0;
              if (received > 0) return received;
              return pi.amount ? Math.round(pi.amount) : 0;
            });

            // Allocate provider share across intents deterministically.
            let remaining = serviceProviderAmount;
            const providerSharesInCents = intentAmountsInCents.map(
              (amountInCents, index) => {
                if (index === intentAmountsInCents.length - 1) {
                  return Math.max(0, Math.min(remaining, amountInCents));
                }
                const suggested = Math.round(amountInCents * 0.9);
                const share = Math.max(
                  0,
                  Math.min(suggested, remaining, amountInCents),
                );
                remaining -= share;
                return share;
              },
            );

            const transferIds: string[] = [];
            for (let i = 0; i < appIntents.length; i++) {
              const pi = appIntents[i];
              const share = providerSharesInCents[i] || 0;
              if (share <= 0) continue;

              const latestCharge = pi.latest_charge;
              const chargeId =
                typeof latestCharge === 'string'
                  ? latestCharge
                  : latestCharge && typeof latestCharge === 'object'
                    ? latestCharge.id
                    : null;
              if (!chargeId || typeof chargeId !== 'string') {
                throw new Error(
                  `Payment intent ${pi.id} does not have a charge ID for source_transaction`,
                );
              }

              const transfer = await this.stripe.transfers.create(
                {
                  amount: share,
                  currency: paymentIntent.currency.toLowerCase(),
                  destination: serviceProviderAccountId,
                  source_transaction: chargeId,
                  metadata: {
                    applicationId: applicationId,
                    jobId: application.job.id,
                    type: 'application_completion',
                    transferMode: 'source_transaction',
                    paymentIntentId: pi.id,
                    chargeId,
                  },
                },
                {
                  idempotencyKey: `xfer_${applicationId}_${chargeId}`,
                },
              );

              transferIds.push(transfer.id);
            }

            transferId = transferIds[0] ?? null;
            transferIdsForNotes = transferIds;
            this.logger.log(
              `✅ Created ${transferIds.length} per-charge transfer(s) for application ${applicationId}. Total provider amount: ${serviceProviderAmount} cents (€${(serviceProviderAmount / 100).toFixed(2)}).`,
            );
          }
        }
      } catch (transferError: unknown) {
        const error = transferError as StripeError;
        this.logger.error('[PaymentsService] ❌ Error creating transfer:', {
          code: error?.code,
          message: error?.message,
          type: error?.type,
          applicationId,
          serviceProviderAmount,
          serviceProviderId: application.applicant.id,
        });
        this.logger.error('[PaymentsService] Full transfer error:', error);
        this.logger.warn(
          `⚠️ Failed to transfer funds to service provider: ${error?.message || 'Unknown error'}. Payment was captured but transfer needs to be created manually.`,
        );
      }
    } else {
      this.logger.warn(
        `⚠️ Service provider amount is 0 or negative (${serviceProviderAmount}), skipping transfer for application ${applicationId}`,
      );
    }

    // Update payment status
    // Store amount in cents (as Int) - totalAmount is already in cents from paymentIntent.amount
    const capturedAmountInCents = Math.round(totalAmount); // Ensure it's an integer

    this.logger.log(
      `Updating payment for application ${applicationId}: capturedAmount=${capturedAmountInCents} cents (${(capturedAmountInCents / 100).toFixed(2)} EUR)`,
    );

    // Get selected rates from payment intent metadata to store what was paid for
    let selectedRatesToStore:
      | Array<{
          rate: number;
          paymentType: string;
          otherSpecification?: string;
        }>
      | undefined;
    try {
      const paymentIntentMetadata = paymentIntent.metadata || {};
      if (paymentIntentMetadata.selectedRates) {
        selectedRatesToStore = JSON.parse(paymentIntentMetadata.selectedRates);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to parse selected rates from payment intent metadata: ${err}`,
      );
    }

    await this.prisma.payment.update({
      where: { id: application.payment.id },
      data: {
        status: PaymentStatusDb.SUCCEEDED,
        amount: capturedAmountInCents, // Store in cents (Int)
        currency: capturedIntent.currency,
      },
    });

    // Update application status and mark as completed
    const completedAtDate = new Date();
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'ACCEPTED', // Keep as ACCEPTED
        completedAt: completedAtDate, // Mark job as completed
      },
    });

    // Update job status to COMPLETED when marked as complete
    try {
      await this.prisma.job.update({
        where: { id: application.job.id },
        data: { status: 'COMPLETED' },
      });
      this.logger.log(
        `[Job Status] Job ${application.job.id} has been set to COMPLETED`,
      );

      // Lock all chat conversations for this job to prevent off-platform deals
      try {
        const lockedCount = await this.chatService.lockConversationsByJobId(
          application.job.id,
        );
        this.logger.log(
          `[Chat] Locked ${lockedCount} conversation(s) for completed job ${application.job.id}`,
        );
      } catch (chatErr) {
        this.logger.warn(
          `[Chat] Failed to lock conversations for job ${application.job.id}: ${chatErr}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `[Job Status] Failed to update job status to COMPLETED: ${err}`,
      );
      // Continue even if job update fails
    }

    // Update existing Booking record or create a new one for the service provider's receipts
    // This allows the payment to show up in their receipts/earnings
    try {
      // First, try to find an existing booking for this job and service provider
      // Check for any booking (including COMPLETED) to avoid duplicates
      const existingBooking = await this.prisma.booking.findFirst({
        where: {
          jobId: application.job.id,
          jobSeekerId: application.applicant.id,
        },
        orderBy: {
          bookedAt: 'desc', // Get the most recent booking
        },
      });

      if (existingBooking) {
        // Update existing booking with correct amount and transfer ID
        const transferIdsText =
          transferIdsForNotes.length > 1
            ? `Transfers: ${transferIdsForNotes.join(', ')}`
            : `Transfer: ${transferId || 'Failed to create'}`;
        const updatedBooking = await this.prisma.booking.update({
          where: { id: existingBooking.id },
          data: {
            status: 'COMPLETED',
            completedAt: completedAtDate,
            capturedAmount: serviceProviderAmount, // Amount service provider receives (after platform fee)
            capturedAt: completedAtDate,
            finalAmount: serviceProviderAmount,
            currency: capturedIntent.currency.toLowerCase(),
            agreedCurrency: capturedIntent.currency.toLowerCase(),
            // Update agreed rate if not already set
            agreedRateAmount:
              existingBooking.agreedRateAmount || serviceProviderAmount,
            // Store Stripe transfer ID for payout tracking
            stripeTransferId: transferId || null,
            payoutStatus: transferId
              ? 'pending'
              : transferId === null
                ? 'failed'
                : null,
            notes: existingBooking.notes
              ? `${existingBooking.notes}\nCompleted on ${completedAtDate.toISOString()} - ${transferIdsText}`
              : `Completed application for "${application.job.title}" - ${transferIdsText}`,
          },
        });
        this.logger.log(
          `✅ Updated existing booking ${updatedBooking.id} for application ${applicationId}: capturedAmount=${serviceProviderAmount} cents (€${(serviceProviderAmount / 100).toFixed(2)}), transferId=${transferId || 'NONE'}`,
        );
      } else {
        // Create new booking if none exists
        const transferIdsText =
          transferIdsForNotes.length > 1
            ? `Transfers: ${transferIdsForNotes.join(', ')}`
            : `Transfer: ${transferId || 'Failed to create'}`;
        const booking = await this.prisma.booking.create({
          data: {
            jobId: application.job.id,
            jobSeekerId: application.applicant.id,
            employerId: application.job.employerId,
            status: 'COMPLETED',
            title: application.job.title,
            notes: `Completed application for "${application.job.title}" - ${transferIdsText}`,
            completedAt: completedAtDate,
            capturedAmount: serviceProviderAmount, // Amount service provider receives (after platform fee)
            capturedAt: completedAtDate,
            finalAmount: serviceProviderAmount,
            currency: capturedIntent.currency.toLowerCase(),
            agreedCurrency: capturedIntent.currency.toLowerCase(),
            // Calculate agreed rate from total amount
            agreedRateAmount: serviceProviderAmount,
            agreedPayUnit: 'PROJECT', // Default to PROJECT for completed applications
            // Store Stripe transfer ID for payout tracking
            stripeTransferId: transferId || null,
            payoutStatus: transferId
              ? 'pending'
              : transferId === null
                ? 'failed'
                : null,
          },
        });
        this.logger.log(
          `✅ Created new booking ${booking.id} for application ${applicationId}: capturedAmount=${serviceProviderAmount} cents (€${(serviceProviderAmount / 100).toFixed(2)}), transferId=${transferId || 'NONE'}`,
        );
        this.logger.log(
          `Created new booking record for completed application ${applicationId}: ${booking.id}`,
        );
      }
    } catch (bookingError: unknown) {
      // Don't fail the completion if booking update/creation fails
      const error = bookingError as { message?: string };
      this.logger.warn(
        `Failed to update/create booking for completed application: ${error?.message || 'Unknown error'}`,
      );
      this.logger.warn(`Booking error details: ${JSON.stringify(error)}`);
    }

    this.logger.log(
      `Application ${applicationId} marked as complete. Payment captured: ${totalAmount / 100} ${capturedIntent.currency}`,
    );

    // Fetch the updated application to get completedAt
    const updatedApplication = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        completedAt: true,
      },
    });

    // Fetch employer details for email
    const employer = await this.prisma.user.findUnique({
      where: { id: application.job.employerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    // Fetch ratings if they exist
    const ratings = await this.prisma.jobCompletionRating.findMany({
      where: { applicationId },
      include: {
        rater: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const employerRating = ratings.find(
      (r) => r.raterId === application.job.employerId,
    );
    const serviceProviderRating = ratings.find(
      (r) => r.raterId === application.applicant.id,
    );

    // Send notifications and emails to both parties
    try {
      // Service Provider Notification
      const serviceProviderNotifT =
        await this.emailTranslations.getTranslatorForUser(
          application.applicant.id,
        );
      await this.notifications.createNotification({
        userId: application.applicant.id,
        type: 'APPLICATION_UPDATE',
        title: serviceProviderNotifT(
          'notifications.templates.jobCompletedTitle',
        ),
        body: serviceProviderNotifT(
          'notifications.templates.jobCompletedBodyProvider',
          {
            jobTitle: application.job.title,
            amount: serviceProviderAmount / 100,
            currency: capturedIntent.currency,
          },
        ),
        payload: {
          applicationId: applicationId,
          jobId: application.job.id,
          amount: serviceProviderAmount / 100,
          currency: capturedIntent.currency,
        },
      });

      // Employer Notification
      if (employer) {
        const employerNotifT =
          await this.emailTranslations.getTranslatorForUser(employer.id);
        await this.notifications.createNotification({
          userId: employer.id,
          type: 'APPLICATION_UPDATE',
          title: employerNotifT('notifications.templates.jobCompletedTitle'),
          body: employerNotifT(
            'notifications.templates.jobCompletedBodyEmployer',
            {
              jobTitle: application.job.title,
            },
          ),
          payload: {
            applicationId: applicationId,
            jobId: application.job.id,
          },
        });
      }

      // Send branded email to service provider
      const serviceProviderT =
        await this.emailTranslations.getTranslatorForUser(
          application.applicantId,
        );
      const serviceProviderName =
        `${application.applicant.firstName} ${application.applicant.lastName}`.trim();
      const employerName = employer
        ? `${employer.firstName} ${employer.lastName}`.trim()
        : serviceProviderT('email.common.employer');

      const serviceProviderEmailContent = this.getJobCompletionEmailContent(
        serviceProviderT,
        application.job.title,
        serviceProviderName,
        employerName,
        serviceProviderAmount / 100,
        capturedIntent.currency,
        serviceProviderRating,
        employerRating,
        false, // isEmployer
      );

      await this.notifications.sendEmail(
        application.applicant.email,
        serviceProviderT('email.payments.jobCompletedSuccessfullySubject', {
          jobTitle: application.job.title,
        }),
        serviceProviderT('email.payments.jobCompletedSuccessfullyText', {
          jobTitle: application.job.title,
          amount: (serviceProviderAmount / 100).toFixed(2),
          currency: capturedIntent.currency,
        }),
        this.notifications.getBrandedEmailTemplate(
          serviceProviderT('email.payments.jobCompletedSuccessfullyTitle'),
          serviceProviderT('email.payments.jobCompletedSuccessfullyGreeting', {
            name: serviceProviderName,
          }),
          serviceProviderEmailContent,
          serviceProviderT('email.payments.jobCompletedSuccessfullyFooter'),
        ),
      );

      // Send branded email to employer
      if (employer) {
        const employerT = await this.emailTranslations.getTranslatorForUser(
          employer.id,
        );

        const employerEmailContent = this.getJobCompletionEmailContent(
          employerT,
          application.job.title,
          employerName,
          serviceProviderName,
          totalAmount / 100,
          capturedIntent.currency,
          employerRating,
          serviceProviderRating,
          true, // isEmployer
        );

        await this.notifications.sendEmail(
          employer.email,
          employerT('email.payments.jobCompletedSuccessfullySubject', {
            jobTitle: application.job.title,
          }),
          employerT('email.payments.jobCompletedSuccessfullyText', {
            jobTitle: application.job.title,
            amount: (totalAmount / 100).toFixed(2),
            currency: capturedIntent.currency,
          }),
          this.notifications.getBrandedEmailTemplate(
            employerT('email.payments.jobCompletedSuccessfullyTitle'),
            employerT('email.payments.jobCompletedSuccessfullyGreeting', {
              name: employerName,
            }),
            employerEmailContent,
            employerT('email.payments.jobCompletedSuccessfullyFooter'),
          ),
        );
      }
    } catch (notifError) {
      this.logger.warn(`Failed to send completion notification: ${notifError}`);
    }

    // Send receipt emails to both parties (like Uber/Bolt)
    try {
      await this.sendReceiptEmails(
        applicationId,
        application,
        employer,
        totalAmount / 100,
        serviceProviderAmount / 100,
        platformFee / 100,
        capturedIntent.currency,
        transferId,
        completedAtDate,
      );
    } catch (receiptError) {
      this.logger.warn(`Failed to send receipt emails: ${receiptError}`);
      // Don't fail the completion if receipt emails fail
    }

    // Ensure completedAt is always a valid ISO string
    let completedAtValue: string;
    if (updatedApplication?.completedAt) {
      completedAtValue = updatedApplication.completedAt.toISOString();
    } else {
      // Fallback to current timestamp if database hasn't updated yet
      completedAtValue = new Date().toISOString();
    }

    return {
      completed: true,
      completedAt: completedAtValue,
      chargeId: (capturedIntent.latest_charge as string) ?? null,
      transferId: transferId || null,
      amount: totalAmount / 100,
      serviceProviderAmount: serviceProviderAmount / 100,
      currency: capturedIntent.currency,
      platformFee: platformFee / 100,
      message: transferId
        ? `Payment of ${serviceProviderAmount / 100} ${capturedIntent.currency} has been transferred to the service provider. They will receive it in their bank account within 24 hours.`
        : `Payment captured. Service provider will receive ${serviceProviderAmount / 100} ${capturedIntent.currency} once their bank account is set up.`,
    };
  }

  /**
   * Generate email content for job completion with ratings
   */
  private getJobCompletionEmailContent(
    t: (key: string, params?: any) => string,
    jobTitle: string,
    recipientName: string,
    otherPartyName: string,
    amount: number,
    currency: string,
    recipientRating: any,
    otherPartyRating: any,
    isEmployer: boolean,
  ): string {
    const starIcon = '⭐';
    const renderStars = (rating: number) => {
      return starIcon.repeat(rating) + '☆'.repeat(5 - rating);
    };

    let content = `
      <div style="background-color: rgba(16, 185, 129, 0.12); padding: 20px; border-radius: 8px; margin: 0 0 24px; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #34d399; font-weight: 600; font-size: 16px;">
          ${t('email.payments.jobCompletedSuccessfullyMessage', { jobTitle })}
        </p>
      </div>
      
      <p style="margin: 0 0 20px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
        ${t('email.payments.jobCompletedPaymentInfo', {
          amount: amount.toFixed(2),
          currency,
          recipientName: isEmployer ? t('email.common.you') : recipientName,
        })}
      </p>
    `;

    // Add ratings section if ratings exist
    if (recipientRating || otherPartyRating) {
      content += `
        <div style="margin: 32px 0; padding: 24px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
          <h3 style="margin: 0 0 20px; color: #F5E6C8; font-size: 18px; font-weight: 600;">
            ${t('email.payments.ratingsSection')}
          </h3>
      `;

      // Show recipient's rating if they rated
      if (recipientRating) {
        content += `
          <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #1E3048;">
            <p style="margin: 0 0 8px; color: #D4A853; font-size: 14px; font-weight: 600;">
              ${t('email.payments.yourRatings')}
            </p>
            ${
              isEmployer
                ? `
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.platformRating')}:</strong> ${renderStars(recipientRating.platformRating)}
              </p>
              ${
                recipientRating.easeOfServiceRating
                  ? `
                <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                  <strong>${t('email.payments.easeOfServiceRating')}:</strong> ${renderStars(recipientRating.easeOfServiceRating)}
                </p>
              `
                  : ''
              }
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.serviceProviderRating')}:</strong> ${renderStars(recipientRating.otherPartyRating)}
              </p>
            `
                : `
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.platformRating')}:</strong> ${renderStars(recipientRating.platformRating)}
              </p>
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.employerRating')}:</strong> ${renderStars(recipientRating.otherPartyRating)}
              </p>
            `
            }
          </div>
        `;
      }

      // Show other party's rating if they rated
      if (otherPartyRating) {
        content += `
          <div>
            <p style="margin: 0 0 8px; color: #D4A853; font-size: 14px; font-weight: 600;">
              ${t('email.payments.otherPartyRatings', { name: otherPartyName })}
            </p>
            ${
              !isEmployer
                ? `
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.platformRating')}:</strong> ${renderStars(otherPartyRating.platformRating)}
              </p>
              ${
                otherPartyRating.easeOfServiceRating
                  ? `
                <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                  <strong>${t('email.payments.easeOfServiceRating')}:</strong> ${renderStars(otherPartyRating.easeOfServiceRating)}
                </p>
              `
                  : ''
              }
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.serviceProviderRating')}:</strong> ${renderStars(otherPartyRating.otherPartyRating)}
              </p>
            `
                : `
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.platformRating')}:</strong> ${renderStars(otherPartyRating.platformRating)}
              </p>
              <p style="margin: 4px 0; color: #8B7A5E; font-size: 14px;">
                <strong>${t('email.payments.employerRating')}:</strong> ${renderStars(otherPartyRating.otherPartyRating)}
              </p>
            `
            }
          </div>
        `;
      } else {
        content += `
          <p style="margin: 0; color: #8B7A5E; font-size: 14px;">
            ${t('email.payments.otherPartyNotRatedYet', { name: otherPartyName })}
          </p>
        `;
      }

      content += `</div>`;
    } else {
      // No ratings yet - encourage rating
      content += `
        <div style="margin: 32px 0; padding: 24px; background-color: rgba(245, 158, 11, 0.12); border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 12px; color: #fbbf24; font-size: 14px; font-weight: 600;">
            ${t('email.payments.rateYourExperience')}
          </p>
          <p style="margin: 0; color: #D4A853; font-size: 14px; line-height: 1.6;">
            ${t('email.payments.rateYourExperienceMessage')}
          </p>
        </div>
      `;
    }

    return content;
  }

  /**
   * Sync booking for a completed application
   * This ensures bookings are updated even if the job was completed before the booking update logic was added
   */
  async syncBookingForCompletedApplication(
    applicationId: string,
    application?: {
      id: string;
      job: { id: string; title: string; employerId: string };
      applicant: { id: string };
      completedAt: Date | null;
      payment?: {
        amount: number | null;
        currency: string | null;
        status: string;
      } | null;
    },
  ) {
    try {
      // Fetch application if not provided
      if (!application) {
        const app = await this.prisma.application.findUnique({
          where: { id: applicationId },
          include: {
            job: {
              select: {
                id: true,
                title: true,
                employerId: true,
              },
            },
            payment: {
              select: {
                amount: true,
                currency: true,
                status: true,
              },
            },
            applicant: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!app) {
          this.logger.warn(
            `Application ${applicationId} not found for booking sync`,
          );
          return;
        }

        application = app;
      }

      // Only sync if application is completed
      if (!application.completedAt) {
        this.logger.log(
          `Application ${applicationId} is not completed, skipping booking sync`,
        );
        return;
      }

      // Reconcile local payment record with Stripe before checking status.
      // The employer may have abandoned a checkout (overwriting the stored PI/session),
      // then paid through a different checkout — leaving local status as CREATED
      // even though Stripe has the money.
      await this.reconcilePaymentRecord(applicationId);

      // Re-fetch payment after reconciliation
      const reconciledPayment = await this.prisma.payment.findFirst({
        where: { applications: { some: { id: applicationId } } },
        select: { amount: true, currency: true, status: true },
      });

      // Check if payment exists and is succeeded
      if (!reconciledPayment || reconciledPayment.status !== 'SUCCEEDED') {
        this.logger.warn(
          `Application ${applicationId} has no succeeded payment, skipping booking sync`,
        );
        return;
      }

      // Use reconciled payment data going forward
      application = {
        ...application,
        payment: reconciledPayment,
      };

      // Calculate service provider amount (after 10% platform fee)
      // Stripe is the source of truth: use cumulative paid amount across all intents.
      // This fixes cases where additional payments overwrote the stored Payment.amount.
      const paymentStatus = await this.checkApplicationPayment(applicationId);
      const totalPaidAmountInCents = Math.round(
        (paymentStatus.paidAmount || 0) * 100,
      );
      const totalAmount =
        totalPaidAmountInCents > 0
          ? totalPaidAmountInCents
          : application.payment.amount || 0;
      const platformFee = Math.round(
        totalAmount * this.getPlatformFeeFraction(),
      );
      const serviceProviderAmount = totalAmount - platformFee; // Subtract fee

      if (serviceProviderAmount <= 0) {
        this.logger.warn(
          `Service provider amount is 0 or negative for application ${applicationId}, skipping booking sync`,
        );
        return;
      }

      // Find existing booking
      const existingBooking = await this.prisma.booking.findFirst({
        where: {
          jobId: application.job.id,
          jobSeekerId: application.applicant.id,
        },
      });

      const currency = application.payment.currency?.toLowerCase() || 'eur';

      if (existingBooking) {
        // Update existing booking if it's not already COMPLETED with capturedAmount
        if (
          existingBooking.status !== 'COMPLETED' ||
          !existingBooking.capturedAmount ||
          existingBooking.capturedAmount === 0
        ) {
          await this.prisma.booking.update({
            where: { id: existingBooking.id },
            data: {
              status: 'COMPLETED',
              completedAt: application.completedAt,
              capturedAmount: serviceProviderAmount,
              capturedAt: application.completedAt,
              finalAmount: serviceProviderAmount,
              currency: currency,
              agreedCurrency: currency,
              notes: existingBooking.notes
                ? `${existingBooking.notes}\nSynced on ${new Date().toISOString()}`
                : `Completed application for "${application.job.title}" (synced)`,
            },
          });
          this.logger.log(
            `✅ Synced booking ${existingBooking.id} for completed application ${applicationId}`,
          );

          // If booking was successfully synced but is missing a transfer, try to backfill it.
          if (!existingBooking.stripeTransferId) {
            const transferResult = await this.createMissingTransfersForBooking(
              existingBooking.id,
            );
            if (!transferResult.success) {
              this.logger.warn(
                `Booking ${existingBooking.id} transfer backfill failed: ${transferResult.message}`,
              );
            } else {
              this.logger.log(
                `✅ Booking ${existingBooking.id} transfer backfilled: ${transferResult.transferId}`,
              );
            }
          }
        } else {
          // Booking has captured amount already; still ensure it has a Stripe transfer attached.
          const hasTransfer =
            !!existingBooking.stripeTransferId &&
            existingBooking.stripeTransferId !== '';
          if (!hasTransfer) {
            const transferResult = await this.createMissingTransfersForBooking(
              existingBooking.id,
            );
            if (!transferResult.success) {
              this.logger.warn(
                `Booking ${existingBooking.id} missing transfer and backfill failed: ${transferResult.message}`,
              );
            } else {
              this.logger.log(
                `✅ Booking ${existingBooking.id} missing transfer fixed: ${transferResult.transferId}`,
              );
            }
          } else {
            this.logger.log(
              `Booking ${existingBooking.id} already has capturedAmount and transfer, skipping sync`,
            );
          }
        }
      } else {
        // Create new booking if none exists
        const booking = await this.prisma.booking.create({
          data: {
            jobId: application.job.id,
            jobSeekerId: application.applicant.id,
            employerId: application.job.employerId,
            status: 'COMPLETED',
            title: application.job.title,
            notes: `Completed application for "${application.job.title}" (synced)`,
            completedAt: application.completedAt,
            capturedAmount: serviceProviderAmount,
            capturedAt: application.completedAt,
            finalAmount: serviceProviderAmount,
            currency: currency,
            agreedCurrency: currency,
            agreedRateAmount: serviceProviderAmount,
            agreedPayUnit: 'PROJECT',
          },
        });
        this.logger.log(
          `✅ Created booking ${booking.id} for completed application ${applicationId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to sync booking for application ${applicationId}: ${error.message}`,
      );
      this.logger.error(`Sync error details: ${JSON.stringify(error)}`);
    }
  }

  /**
   * Sync bookings for a specific service provider
   * Finds all their bookings and syncs them with completed applications
   */
  async syncBookingsForServiceProvider(serviceProviderId: string) {
    this.logger.log(
      `Starting sync of bookings for service provider ${serviceProviderId}...`,
    );

    try {
      // Find all bookings for this service provider
      const bookings = await this.prisma.booking.findMany({
        where: {
          jobSeekerId: serviceProviderId,
          jobId: { not: null }, // Only bookings linked to jobs
        },
        include: {
          job: {
            include: {
              applications: {
                where: {
                  applicantId: serviceProviderId,
                  completedAt: { not: null },
                },
                include: {
                  payment: {
                    select: {
                      amount: true,
                      currency: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      this.logger.log(
        `Found ${bookings.length} bookings for service provider ${serviceProviderId}`,
      );

      let syncedCount = 0;
      let errorCount = 0;

      let transfersCreated = 0;
      let transfersLinked = 0;
      let transferErrors = 0;

      for (const booking of bookings) {
        if (!booking.job) continue;

        // Find completed application for this booking.
        // First try the fast path (local status already SUCCEEDED).
        let completedApplication = booking.job.applications.find(
          (app) => app.completedAt && app.payment?.status === 'SUCCEEDED',
        );

        // If no locally-SUCCEEDED app found, try reconciling any completed
        // application whose payment status is stale (e.g. CREATED after
        // an abandoned checkout, even though Stripe holds the money).
        if (!completedApplication) {
          const staleCandidates = booking.job.applications.filter(
            (app) => app.completedAt && app.payment,
          );
          for (const candidate of staleCandidates) {
            await this.reconcilePaymentRecord(candidate.id);
          }
          // Re-fetch applications after reconciliation
          if (staleCandidates.length > 0) {
            const freshJob = await this.prisma.job.findUnique({
              where: { id: booking.job.id },
              include: {
                applications: {
                  where: {
                    applicantId: serviceProviderId,
                    completedAt: { not: null },
                  },
                  include: {
                    payment: {
                      select: { amount: true, currency: true, status: true },
                    },
                  },
                },
              },
            });
            completedApplication = freshJob?.applications.find(
              (app) => app.completedAt && app.payment?.status === 'SUCCEEDED',
            );
          }
        }

        if (completedApplication) {
          try {
            // Sync this booking with the completed application
            // Pass only the applicationId - the method will fetch it with the correct structure
            await this.syncBookingForCompletedApplication(
              completedApplication.id,
            );
            syncedCount++;

            // After syncing amounts/status, ensure the booking has a Stripe transfer.
            const refreshed = await this.prisma.booking.findUnique({
              where: { id: booking.id },
              select: {
                id: true,
                status: true,
                capturedAmount: true,
                stripeTransferId: true,
              },
            });

            const needsTransfer =
              !!refreshed &&
              refreshed.status === 'COMPLETED' &&
              !!refreshed.capturedAmount &&
              refreshed.capturedAmount > 0 &&
              (!refreshed.stripeTransferId ||
                refreshed.stripeTransferId === '');

            if (needsTransfer) {
              const transferResult =
                await this.createMissingTransfersForBooking(booking.id);
              if (transferResult.success) {
                if (transferResult.action === 'linked') {
                  transfersLinked++;
                } else if (
                  transferResult.action === 'created_balance' ||
                  transferResult.action === 'created_source_transaction' ||
                  transferResult.action === 'created_source_transaction_multi'
                ) {
                  transfersCreated++;
                } else {
                  // Default bucket for any future success actions
                  transfersCreated++;
                }
              } else {
                transferErrors++;
              }
            }
          } catch (error: any) {
            this.logger.error(
              `Failed to sync booking ${booking.id}: ${error.message}`,
            );
            errorCount++;
          }
        }
      }

      this.logger.log(
        `✅ Sync completed for service provider ${serviceProviderId}: ${syncedCount} synced, ${errorCount} errors`,
      );
      return {
        synced: syncedCount,
        errors: errorCount,
        total: bookings.length,
        transfersCreated,
        transfersLinked,
        transferErrors,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to sync bookings for service provider ${serviceProviderId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Sync all completed applications with their bookings
   * This is useful for fixing bookings that weren't updated when jobs were completed
   */
  async syncAllCompletedApplicationsBookings() {
    this.logger.log(
      'Starting sync of all completed applications with bookings...',
    );

    try {
      // Find all completed applications with succeeded payments
      const completedApplications = await this.prisma.application.findMany({
        where: {
          completedAt: { not: null },
          payment: {
            status: 'SUCCEEDED',
          },
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              employerId: true,
            },
          },
          payment: {
            select: {
              amount: true,
              currency: true,
              status: true,
            },
          },
          applicant: {
            select: {
              id: true,
            },
          },
        },
      });

      this.logger.log(
        `Found ${completedApplications.length} completed applications to sync`,
      );

      let syncedCount = 0;
      let errorCount = 0;

      for (const app of completedApplications) {
        try {
          await this.syncBookingForCompletedApplication(app.id, app);
          syncedCount++;
        } catch (error: any) {
          this.logger.error(
            `Failed to sync application ${app.id}: ${error.message}`,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `✅ Sync completed: ${syncedCount} synced, ${errorCount} errors`,
      );
      return {
        synced: syncedCount,
        errors: errorCount,
        total: completedApplications.length,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to sync completed applications: ${error.message}`,
      );
      throw error;
    }
  }

  async cancelBookingHold(employerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { job: true },
    });
    if (!booking) throw new InternalServerErrorException('Booking not found');
    const full = booking as unknown as {
      id: string;
      holdIntentId: string | null;
      employerId: string | null;
      job: { employerId: string } | null;
    };
    const ownerEmployerId = full.job ? full.job.employerId : full.employerId;
    if (!ownerEmployerId || ownerEmployerId !== employerId) {
      throw new InternalServerErrorException(
        'Not authorized to cancel this booking hold',
      );
    }
    if (!full.holdIntentId) return { canceled: false };
    await this.stripe.paymentIntents.cancel(full.holdIntentId, undefined, {
      idempotencyKey: `booking_cancel_${bookingId}`,
    });
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { holdIntentId: null, holdAmount: null },
    });
    return { canceled: true };
  }

  private computePlatformFee(amount: number): number {
    const percent = this.getPlatformFeePercent(); // e.g., 20%
    const flat = Number(this.config.get('PLATFORM_FEE_FLAT') ?? '0'); // in minor units
    const fee = Math.floor((amount * percent) / 100) + flat;
    return fee;
  }

  private getPlatformFeePercent(): number {
    const percent = Number(this.config.get('PLATFORM_FEE_PERCENT') ?? '20');
    return Number.isFinite(percent) ? percent : 20;
  }

  private getPlatformFeeFraction(): number {
    return this.getPlatformFeePercent() / 100;
  }

  private computeFinalAmount(
    booking: {
      approvedUnits: number | null;
      agreedRateAmount: number | null;
      agreedPayUnit: PaymentType | null;
    },
    job: { rateAmount: number | null; paymentType: PaymentType },
    dto: CaptureBookingDto,
  ): number {
    if (dto.finalAmount && dto.finalAmount > 0) return dto.finalAmount;
    const unit: PaymentType | null | undefined =
      booking.agreedPayUnit ?? job.paymentType;
    const rate: number | null | undefined =
      booking.agreedRateAmount ?? job.rateAmount;
    if (!unit || !rate) {
      throw new InternalServerErrorException(
        'Missing agreed terms to compute final amount',
      );
    }
    const units = dto.approvedUnits ?? booking.approvedUnits ?? 0;
    if (units <= 0) {
      throw new InternalServerErrorException('Approved units required');
    }
    return rate * units;
  }

  // Delete a bank account from a Connect account
  async deleteBankAccount(userId: string, bankAccountId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { connectedAccountId: true },
    });

    if (!user?.connectedAccountId) {
      throw new BadRequestException('No Stripe Connect account found');
    }

    try {
      // Delete the external account (bank account) from Stripe
      await this.stripe.accounts.deleteExternalAccount(
        user.connectedAccountId,
        bankAccountId,
      );

      this.logger.log(
        '[PaymentsService] ✅ Bank account deleted:',
        bankAccountId,
      );
      return { success: true, message: 'Bank account deleted successfully' };
    } catch (error: any) {
      this.logger.error(
        '[PaymentsService] Error deleting bank account:',
        error?.message,
      );

      if (error?.type === 'StripeInvalidRequestError') {
        if (error?.code === 'resource_missing') {
          throw new BadRequestException('Bank account not found');
        }
        throw new BadRequestException(
          error.message || 'Failed to delete bank account',
        );
      }

      throw new InternalServerErrorException('Failed to delete bank account');
    }
  }

  // Set a bank account as default for payouts
  async setDefaultBankAccount(userId: string, bankAccountId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { connectedAccountId: true },
    });

    if (!user?.connectedAccountId) {
      throw new BadRequestException('No Stripe Connect account found');
    }

    try {
      // Retrieve the bank account to get its currency
      const bankAccount = await this.stripe.accounts.retrieveExternalAccount(
        user.connectedAccountId,
        bankAccountId,
      );

      if (!bankAccount || bankAccount.object !== 'bank_account') {
        throw new BadRequestException('Bank account not found');
      }

      // Update the account to set this bank account as default for its currency
      await this.stripe.accounts.updateExternalAccount(
        user.connectedAccountId,
        bankAccountId,
        {
          default_for_currency: true,
        },
      );

      this.logger.log(
        '[PaymentsService] ✅ Bank account set as default:',
        bankAccountId,
      );
      return {
        success: true,
        message: 'Default bank account updated successfully',
      };
    } catch (error: any) {
      this.logger.error(
        '[PaymentsService] Error setting default bank account:',
        error?.message,
      );

      if (error?.type === 'StripeInvalidRequestError') {
        if (error?.code === 'resource_missing') {
          throw new BadRequestException('Bank account not found');
        }
        throw new BadRequestException(
          error.message || 'Failed to set default bank account',
        );
      }

      throw new InternalServerErrorException(
        'Failed to set default bank account',
      );
    }
  }

  /**
   * Refund an application payment with cancellation fee deduction
   * @param paymentId Payment ID to refund
   * @param refundAmount Amount to refund (in cents, after fee deduction)
   * @param cancellationFee Cancellation fee amount (in cents)
   * @param reason Reason for refund
   */
  async refundApplicationPayment(
    paymentId: string,
    refundAmount: number,
    cancellationFee: number,
    reason: string,
  ) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          stripePaymentIntentId: true,
          amount: true,
          currency: true,
          status: true,
          metadata: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (!payment.stripePaymentIntentId) {
        throw new BadRequestException('Payment intent not found');
      }

      if (payment.status !== PaymentStatusDb.SUCCEEDED) {
        throw new BadRequestException('Payment must be succeeded to refund');
      }

      // Retrieve the payment intent from Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId,
      );

      if (
        paymentIntent.status !== 'succeeded' &&
        paymentIntent.status !== 'requires_capture'
      ) {
        throw new BadRequestException(
          `Payment intent is in ${paymentIntent.status} status and cannot be refunded`,
        );
      }

      // If payment is in requires_capture, we can just cancel it (no refund needed)
      if (paymentIntent.status === 'requires_capture') {
        await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
        this.logger.log(
          `Cancelled payment intent ${payment.stripePaymentIntentId} (was in requires_capture)`,
        );
        return {
          refunded: true,
          refundAmount: 0,
          cancellationFee,
          reason: 'Payment was cancelled (not yet captured)',
        };
      }

      // Create partial refund (refundAmount, keeping cancellationFee)
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundAmount, // Refund 90% (after 10% fee)
        reason: 'requested_by_customer',
        metadata: {
          cancellationFee: cancellationFee.toString(),
          reason,
          refundType: 'cancellation_with_fee',
        },
      });

      // Update payment status and metadata
      // Keep status as SUCCEEDED but mark as refunded in metadata
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatusDb.SUCCEEDED, // Keep as SUCCEEDED, mark refund in metadata
          metadata: {
            ...((payment.metadata as any) || {}),
            refundId: refund.id,
            refundAmount,
            cancellationFee,
            refundReason: reason,
            refundedAt: new Date().toISOString(),
            isRefunded: true,
          },
        },
      });

      this.logger.log(
        `Refunded payment ${paymentId}: ${refundAmount} ${payment.currency} (fee: ${cancellationFee} ${payment.currency})`,
      );

      return {
        refunded: true,
        refundAmount,
        cancellationFee,
        refundId: refund.id,
        reason,
      };
    } catch (error: any) {
      this.logger.error(`Error refunding payment ${paymentId}:`, error);
      throw new InternalServerErrorException(
        `Failed to process refund: ${error.message}`,
      );
    }
  }

  /**
   * Sync payout status for a booking by checking Stripe transfer status
   */
  async syncBookingPayoutStatus(bookingId: string) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          stripeTransferId: true,
          payoutStatus: true,
          payoutDate: true,
          jobSeekerId: true,
        },
      });

      if (!booking || !booking.stripeTransferId) {
        return {
          bookingId,
          hasTransfer: false,
          message: 'No Stripe transfer found for this booking',
        };
      }

      // Check transfer status in Stripe
      const transfer = await this.stripe.transfers.retrieve(
        booking.stripeTransferId,
      );

      // Check if transfer has been paid out by looking at balance transactions
      // Transfers to Connect accounts are paid out according to the account's payout schedule
      // We can check the balance transaction to see if it's been paid out
      let payoutStatus = 'pending';
      let payoutDate: Date | null = null;

      if (transfer.reversed) {
        payoutStatus = 'failed';
      } else {
        // Check balance transactions for this transfer
        // Note: Stripe doesn't support filtering by transfer directly
        // We'll check the transfer object and look for related payouts

        // Check for payouts to the connected account
        const connectedAccountId = transfer.destination as string;
        try {
          const payouts = await this.stripe.payouts.list(
            {
              limit: 100,
            },
            {
              stripeAccount: connectedAccountId,
            },
          );

          // Find if this transfer amount is in any payout
          for (const payout of payouts.data) {
            if (payout.status === 'paid' && payout.arrival_date) {
              // Check if this transfer is included in the payout by checking balance transactions
              try {
                const payoutTransactions =
                  await this.stripe.balanceTransactions.list(
                    {
                      limit: 100,
                    },
                    {
                      stripeAccount: connectedAccountId,
                    },
                  );

                // Check if any transaction references our transfer
                // The source field should match our transfer ID
                // We'll check all transactions and see if any match our transfer
                // and were created around the payout time
                const transferCreatedAt = transfer.created;
                const payoutCreatedAt = payout.created;

                const hasTransfer = payoutTransactions.data.some((tx) => {
                  // Check if transaction source matches our transfer
                  const matchesTransfer =
                    tx.source === booking.stripeTransferId;
                  // Check if transaction was created before or around payout time
                  // (transfers are usually included in the next payout after they're created)
                  const txCreated = tx.created;
                  const isBeforePayout = txCreated <= payoutCreatedAt;
                  // Allow some time window (up to 7 days before payout)
                  const timeDiff = payoutCreatedAt - txCreated;
                  const sevenDaysInSeconds = 7 * 24 * 60 * 60;
                  const isWithinTimeWindow =
                    timeDiff >= 0 && timeDiff <= sevenDaysInSeconds;

                  return (
                    matchesTransfer && (isBeforePayout || isWithinTimeWindow)
                  );
                });

                if (hasTransfer) {
                  payoutStatus = 'paid';
                  payoutDate = new Date(payout.arrival_date * 1000);
                  break;
                }
              } catch (txError) {
                // Continue to next payout if we can't check transactions
                this.logger.warn(
                  `Could not check transactions for payout ${payout.id}: ${txError}`,
                );
              }
            }
          }
        } catch (payoutError) {
          // If we can't list payouts, check transfer status directly
          this.logger.warn(
            `Could not list payouts for account ${connectedAccountId}: ${payoutError}`,
          );
          // Transfer is created but payout status is unknown - keep as pending
        }
      }

      // Update booking with payout status
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          payoutStatus,
          payoutDate,
        },
      });

      return {
        bookingId,
        transferId: booking.stripeTransferId,
        payoutStatus,
        payoutDate: payoutDate?.toISOString() || null,
        message: `Payout status updated to: ${payoutStatus}`,
      };
    } catch (error: any) {
      this.logger.error(
        `Error syncing payout status for booking ${bookingId}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to sync payout status: ${error.message}`,
      );
    }
  }

  /**
   * Sync payout status for all bookings of a service provider
   */
  async syncServiceProviderPayouts(serviceProviderId: string) {
    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          jobSeekerId: serviceProviderId,
          stripeTransferId: { not: null },
          OR: [{ payoutStatus: 'pending' }, { payoutStatus: null }],
        },
        select: {
          id: true,
        },
      });

      const results = [];
      for (const booking of bookings) {
        try {
          const result = await this.syncBookingPayoutStatus(booking.id);
          results.push(result);
        } catch (error: any) {
          results.push({
            bookingId: booking.id,
            error: error.message,
          });
        }
      }

      return {
        synced: results.length,
        results,
      };
    } catch (error: any) {
      this.logger.error(
        `Error syncing payouts for service provider ${serviceProviderId}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to sync payouts: ${error.message}`,
      );
    }
  }

  /**
   * Retroactively create transfers for completed bookings that don't have transfers yet
   * This is useful for bookings that were completed before the transfer creation logic was added
   */
  async createMissingTransfersForBooking(bookingId: string) {
    try {
      // First get the booking to get jobSeekerId
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          jobSeekerId: true,
          jobId: true,
          capturedAmount: true,
          currency: true,
          stripeTransferId: true,
        },
      });

      if (!booking) {
        return {
          success: false,
          action: 'not_found',
          message: 'Booking not found',
        };
      }

      if (booking.stripeTransferId) {
        return {
          success: false,
          action: 'already_has_transfer',
          message: 'Booking already has a transfer',
          transferId: booking.stripeTransferId,
        };
      }

      if (!booking.capturedAmount || booking.capturedAmount <= 0) {
        return {
          success: false,
          action: 'no_captured_amount',
          message: 'Booking has no captured amount',
        };
      }

      if (!booking.jobId) {
        return {
          success: false,
          action: 'no_job',
          message: 'Booking is not linked to a job',
        };
      }

      // Now get the job and application with the jobSeekerId
      const job = await this.prisma.job.findUnique({
        where: { id: booking.jobId },
        include: {
          applications: {
            where: {
              applicantId: booking.jobSeekerId,
              completedAt: { not: null },
            },
            include: {
              payment: true,
              applicant: {
                select: {
                  id: true,
                  connectedAccountId: true,
                },
              },
            },
          },
        },
      });

      if (!job) {
        return {
          success: false,
          action: 'job_not_found',
          message: 'Job not found',
        };
      }

      // Find the completed application
      const application = job.applications[0];
      if (!application || !application.payment) {
        return {
          success: false,
          action: 'no_completed_application',
          message: 'No completed application or payment found',
        };
      }

      // Ensure Connect account exists
      const ensured = await this.ensureConnectAccount(booking.jobSeekerId);
      const serviceProviderAccountId = ensured.accountId;

      if (!serviceProviderAccountId) {
        return {
          success: false,
          action: 'no_connect_account',
          message: 'Could not get or create Connect account',
        };
      }

      // Safety: if a transfer was created previously but the booking wasn't updated,
      // try to find and link it before creating a new transfer.
      try {
        const bookingCurrency = (booking.currency?.toLowerCase() ||
          'eur') as string;

        const completedAtSeconds = application.completedAt
          ? Math.floor(new Date(application.completedAt).getTime() / 1000)
          : null;
        const createdWindow: any = completedAtSeconds
          ? {
              // Look slightly before completion to catch retries/async flows.
              gte: completedAtSeconds - 14 * 24 * 60 * 60,
            }
          : undefined;

        // Stripe does not support server-side filtering by metadata; we list recent transfers
        // and match by metadata + amount/currency + destination.
        let transfers: Stripe.ApiList<Stripe.Transfer>;
        try {
          // @ts-ignore - destination filter exists in Stripe API, but may not be typed in older SDKs
          transfers = await this.stripe.transfers.list({
            limit: 100,
            destination: serviceProviderAccountId,
            ...(createdWindow ? { created: createdWindow } : {}),
          });
        } catch {
          transfers = await this.stripe.transfers.list({ limit: 100 });
        }

        const existing = (transfers.data || []).find((t) => {
          if (!t || t.reversed) return false;
          if (t.amount !== booking.capturedAmount) return false;
          if ((t.currency || '').toLowerCase() !== bookingCurrency)
            return false;

          const md: Record<string, string> = (t.metadata as any) || {};
          const matchesMetadata =
            md.bookingId === booking.id ||
            md.applicationId === application.id ||
            md.jobId === job.id;

          // When we couldn't server-filter by destination, ensure destination matches too.
          const destinationMatches =
            typeof t.destination === 'string'
              ? t.destination === serviceProviderAccountId
              : (t.destination as any)?.id === serviceProviderAccountId;

          return matchesMetadata && destinationMatches;
        });

        if (existing) {
          await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
              stripeTransferId: existing.id,
              payoutStatus: 'pending',
            },
          });

          this.logger.log(
            `Linked existing transfer ${existing.id} to booking ${bookingId} (matched by metadata/amount)`,
          );

          return {
            success: true,
            action: 'linked',
            transferId: existing.id,
            message: 'Linked existing transfer to booking',
          };
        }
      } catch (linkError: any) {
        this.logger.warn(
          `Could not search/link existing transfer for booking ${bookingId}: ${linkError?.message || linkError}`,
        );
        // Continue to create a retroactive transfer.
      }

      const currency = booking.currency?.toLowerCase() || 'eur';

      // Preferred: create a single balance-funded transfer (most reliable and matches current completion logic).
      try {
        const transfer = await this.stripe.transfers.create(
          {
            amount: booking.capturedAmount,
            currency,
            destination: serviceProviderAccountId,
            metadata: {
              bookingId: booking.id,
              applicationId: application.id,
              jobId: job.id,
              type: 'retroactive_transfer',
              transferMode: 'balance',
            },
          },
          {
            idempotencyKey: `retro_xfer_${bookingId}_total_${booking.capturedAmount}_${currency}`,
          },
        );

        await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            stripeTransferId: transfer.id,
            payoutStatus: 'pending',
          },
        });

        this.logger.log(
          `Retroactively created balance transfer ${transfer.id} for booking ${bookingId}`,
        );

        return {
          success: true,
          action: 'created_balance',
          transferId: transfer.id,
          message: 'Transfer created successfully',
        };
      } catch (balanceError: any) {
        this.logger.warn(
          `Retroactive balance transfer failed for booking ${bookingId}: ${balanceError?.message || balanceError}`,
        );
      }

      // Fallback: per-charge transfers across all PaymentIntents for the application.
      const employerId = (job as any).employerId as string | undefined;
      if (!employerId) {
        return {
          success: false,
          action: 'no_employer',
          message: 'Job employer not found',
        };
      }

      const { customerId } = await this.ensureCustomer(employerId);
      const list = await this.stripe.paymentIntents.list({
        customer: customerId,
        limit: 50,
        expand: ['data.latest_charge'],
      });

      const appIntents = (list.data || [])
        .filter((pi) => {
          const md = pi.metadata || {};
          return (
            md.applicationId === application.id &&
            (md.type === 'application_payment' || md.type === undefined)
          );
        })
        .filter((pi) => {
          if (pi.status === 'succeeded' || pi.status === 'requires_capture') {
            return true;
          }
          if (pi.status === 'processing') {
            const received =
              typeof pi.amount_received === 'number' ? pi.amount_received : 0;
            return received > 0;
          }
          return false;
        })
        .slice()
        .sort((a, b) => (a.created || 0) - (b.created || 0));

      if (appIntents.length === 0) {
        return {
          success: false,
          action: 'no_payment_intents',
          message: `No completed payment intents found for application ${application.id}`,
        };
      }

      const intentAmountsInCents = appIntents.map((pi) => {
        if (pi.status === 'requires_capture') {
          return pi.amount ? Math.round(pi.amount) : 0;
        }
        const received =
          typeof pi.amount_received === 'number'
            ? Math.round(pi.amount_received)
            : 0;
        if (received > 0) return received;
        return pi.amount ? Math.round(pi.amount) : 0;
      });

      let remaining = booking.capturedAmount;
      const providerSharesInCents = intentAmountsInCents.map(
        (amountInCents, index) => {
          if (index === intentAmountsInCents.length - 1) {
            return Math.max(0, Math.min(remaining, amountInCents));
          }
          const suggested = Math.round(amountInCents * 0.9);
          const share = Math.max(
            0,
            Math.min(suggested, remaining, amountInCents),
          );
          remaining -= share;
          return share;
        },
      );

      const transferIds: string[] = [];
      for (let i = 0; i < appIntents.length; i++) {
        const pi = appIntents[i];
        const share = providerSharesInCents[i] || 0;
        if (share <= 0) continue;

        const latestCharge = pi.latest_charge;
        const chargeId =
          typeof latestCharge === 'string'
            ? latestCharge
            : latestCharge && typeof latestCharge === 'object'
              ? (latestCharge as any).id
              : null;

        if (!chargeId || typeof chargeId !== 'string') {
          return {
            success: false,
            action: 'missing_charge',
            message: `Payment intent ${pi.id} does not have a charge ID for source_transaction`,
          };
        }

        const transfer = await this.stripe.transfers.create(
          {
            amount: share,
            currency,
            destination: serviceProviderAccountId,
            source_transaction: chargeId,
            metadata: {
              bookingId: booking.id,
              applicationId: application.id,
              jobId: job.id,
              type: 'retroactive_transfer',
              transferMode: 'source_transaction',
              paymentIntentId: pi.id,
              chargeId,
            },
          },
          {
            idempotencyKey: `retro_xfer_${bookingId}_${chargeId}`,
          },
        );

        transferIds.push(transfer.id);
      }

      if (transferIds.length === 0) {
        return {
          success: false,
          action: 'no_transfers_created',
          message: 'No transfers were created for this booking',
        };
      }

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          stripeTransferId: transferIds[0],
          payoutStatus: 'pending',
        },
      });

      this.logger.log(
        `Retroactively created ${transferIds.length} source_transaction transfer(s) for booking ${bookingId}: ${transferIds.join(', ')}`,
      );

      return {
        success: true,
        action:
          transferIds.length > 1
            ? 'created_source_transaction_multi'
            : 'created_source_transaction',
        transferId: transferIds[0],
        transferIds,
        message: 'Transfer created successfully',
      };
    } catch (error: any) {
      this.logger.error(
        `Error creating missing transfer for booking ${bookingId}:`,
        error,
      );
      return {
        success: false,
        action: 'failed',
        message: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Automatically find and create missing transfers for all completed bookings
   * This fixes jobs that were completed before the transfer fix was implemented
   */
  async fixAllMissingTransfers() {
    try {
      this.logger.log(
        'Starting to fix all missing transfers for completed bookings...',
      );

      // Find all completed bookings without transfers
      const bookingsWithoutTransfers = await this.prisma.booking.findMany({
        where: {
          status: 'COMPLETED',
          capturedAmount: { gt: 0 }, // Has captured amount
          OR: [{ stripeTransferId: null }, { stripeTransferId: '' }],
        },
        include: {
          job: {
            include: {
              applications: {
                where: {
                  completedAt: { not: null },
                },
                include: {
                  payment: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(
        `Found ${bookingsWithoutTransfers.length} completed bookings without transfers`,
      );

      const results = [];
      for (const booking of bookingsWithoutTransfers) {
        try {
          const result = await this.createMissingTransfersForBooking(
            booking.id,
          );
          results.push({
            bookingId: booking.id,
            ...result,
          });
        } catch (error: any) {
          results.push({
            bookingId: booking.id,
            success: false,
            message: error.message || 'Unknown error',
          });
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      this.logger.log(
        `✅ Fixed missing transfers: ${successful} successful, ${failed} failed`,
      );

      return {
        total: bookingsWithoutTransfers.length,
        successful,
        failed,
        results,
      };
    } catch (error: any) {
      this.logger.error('Error fixing missing transfers:', error);
      throw new InternalServerErrorException(
        `Failed to fix missing transfers: ${error.message}`,
      );
    }
  }

  /**
   * Generate a unique receipt number in format RCPT-YYYY-NNNNNN
   */
  private async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RCPT-${year}-`;

    // Find the highest receipt number for this year (check booking notes or create a sequence)
    // For now, we'll use a timestamp-based approach with a sequence
    const timestamp = Date.now();
    const sequence = Math.floor((timestamp % 1000000) / 1000); // Use last 6 digits of timestamp

    // Format with leading zeros (6 digits)
    const receiptNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;
    return receiptNumber;
  }

  /**
   * Send receipt emails to both employer and service provider (like Uber/Bolt)
   */
  private async sendReceiptEmails(
    applicationId: string,
    application: any,
    employer: any,
    totalAmount: number,
    serviceProviderAmount: number,
    platformFee: number,
    currency: string,
    transferId: string | null,
    completedAt: Date,
    options?: { sendEmployer?: boolean; sendServiceProvider?: boolean },
  ): Promise<void> {
    const sendEmployer = options?.sendEmployer ?? true;
    const sendServiceProvider = options?.sendServiceProvider ?? true;

    const paymentId: string | undefined =
      application?.paymentId ?? application?.payment?.id;
    let paymentMetadata: any = undefined;
    let receiptNumber: string | undefined = undefined;

    let shouldSendEmployer = sendEmployer;
    let shouldSendServiceProvider = sendServiceProvider;

    if (paymentId) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        select: { metadata: true },
      });
      paymentMetadata = payment?.metadata as any;
      const receiptsByApplication = paymentMetadata?.receipts?.byApplication;
      const existing = receiptsByApplication?.[applicationId];
      receiptNumber = existing?.receiptNumber;

      shouldSendEmployer = sendEmployer && !existing?.employerSentAt;
      shouldSendServiceProvider =
        sendServiceProvider && !existing?.serviceProviderSentAt;

      if (!shouldSendEmployer && !shouldSendServiceProvider) {
        this.logger.log(
          `ℹ️ Receipt emails already sent for application ${applicationId}; skipping`,
        );
        return;
      }
    }

    if (!receiptNumber) {
      receiptNumber = await this.generateReceiptNumber();
    }
    const jobTitle = application.job.title;
    const serviceProviderName =
      `${application.applicant.firstName} ${application.applicant.lastName}`.trim();

    // Get translations for both parties
    const serviceProviderT = await this.emailTranslations.getTranslatorForUser(
      application.applicantId,
    );
    const employerT = employer
      ? await this.emailTranslations.getTranslatorForUser(employer.id)
      : serviceProviderT;

    const formatCompletedDate = (t: (key: string, params?: any) => string) =>
      completedAt.toLocaleDateString(t('email.common.locale'), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    const completedDateForServiceProvider =
      formatCompletedDate(serviceProviderT);
    const completedDateForEmployer = formatCompletedDate(employerT);
    const employerName = employer
      ? `${employer.firstName} ${employer.lastName}`.trim()
      : employerT('email.common.employer');

    // Generate receipt HTML for service provider
    const serviceProviderReceiptHtml = this.generateReceiptHtml({
      receiptNumber,
      recipientName: serviceProviderName,
      recipientType: 'service_provider',
      jobTitle,
      otherPartyName: employerName,
      serviceDate: completedDateForServiceProvider,
      paymentDate: completedDateForServiceProvider,
      subtotal: serviceProviderAmount,
      platformFee: 0, // Service provider doesn't see platform fee as a separate line
      total: serviceProviderAmount,
      currency,
      transferId,
      isServiceProvider: true,
      t: serviceProviderT,
    });

    // Generate receipt HTML for employer
    const employerReceiptHtml = this.generateReceiptHtml({
      receiptNumber,
      recipientName: employerName,
      recipientType: 'employer',
      jobTitle,
      otherPartyName: serviceProviderName,
      serviceDate: completedDateForEmployer,
      paymentDate: completedDateForEmployer,
      subtotal: totalAmount - platformFee,
      platformFee,
      total: totalAmount,
      currency,
      transferId: null, // Employer doesn't need transfer ID
      isServiceProvider: false,
      t: employerT,
    });

    // Send receipt to service provider
    if (shouldSendServiceProvider) {
      try {
        const serviceProviderSubject = serviceProviderT(
          'email.receipts.receiptSubject',
          {
            receiptNumber,
            jobTitle,
          },
        );

        const serviceProviderText = serviceProviderT(
          'email.receipts.receiptText',
          {
            receiptNumber,
            jobTitle,
            amount: serviceProviderAmount.toFixed(2),
            currency,
          },
        );

        const serviceProviderLang =
          await this.emailTranslations.getUserLanguage(application.applicantId);
        const serviceProviderLanguage = serviceProviderLang
          ?.toLowerCase()
          .startsWith('pt')
          ? 'pt'
          : 'en';
        await this.notifications.sendEmail(
          application.applicant.email,
          serviceProviderSubject,
          serviceProviderText,
          this.notifications.getBrandedEmailTemplate(
            serviceProviderT('email.receipts.receiptTitle'),
            serviceProviderT('email.receipts.receiptGreeting', {
              name: serviceProviderName,
            }),
            serviceProviderReceiptHtml,
            serviceProviderT('email.receipts.receiptFooter'),
            serviceProviderT,
            serviceProviderLanguage,
          ),
        );
        this.logger.log(
          `✅ Receipt email sent to service provider: ${application.applicant.email}`,
        );
        if (paymentId) {
          const nextMetadata = {
            ...(paymentMetadata ?? {}),
            receipts: {
              ...((paymentMetadata ?? {})?.receipts ?? {}),
              byApplication: {
                ...((paymentMetadata ?? {})?.receipts?.byApplication ?? {}),
                [applicationId]: {
                  ...((paymentMetadata ?? {})?.receipts?.byApplication?.[
                    applicationId
                  ] ?? {}),
                  receiptNumber,
                  serviceProviderSentAt: new Date().toISOString(),
                },
              },
            },
          };
          await this.prisma.payment.update({
            where: { id: paymentId },
            data: { metadata: nextMetadata as any },
          });
          paymentMetadata = nextMetadata;
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to send receipt email to service provider: ${error}`,
        );
      }
    }

    // Send receipt to employer
    if (shouldSendEmployer && employer) {
      try {
        const employerSubject = employerT('email.receipts.receiptSubject', {
          receiptNumber,
          jobTitle,
        });

        const employerText = employerT('email.receipts.receiptText', {
          receiptNumber,
          jobTitle,
          amount: totalAmount.toFixed(2),
          currency,
        });

        const employerLang = employer
          ? await this.emailTranslations.getUserLanguage(employer.id)
          : 'en';
        const employerLanguage = employerLang?.toLowerCase().startsWith('pt')
          ? 'pt'
          : 'en';
        await this.notifications.sendEmail(
          employer.email,
          employerSubject,
          employerText,
          this.notifications.getBrandedEmailTemplate(
            employerT('email.receipts.receiptTitle'),
            employerT('email.receipts.receiptGreeting', {
              name: employerName,
            }),
            employerReceiptHtml,
            employerT('email.receipts.receiptFooter'),
            employerT,
            employerLanguage,
          ),
        );
        this.logger.log(`✅ Receipt email sent to employer: ${employer.email}`);

        if (paymentId) {
          const nextMetadata = {
            ...(paymentMetadata ?? {}),
            receipts: {
              ...((paymentMetadata ?? {})?.receipts ?? {}),
              byApplication: {
                ...((paymentMetadata ?? {})?.receipts?.byApplication ?? {}),
                [applicationId]: {
                  ...((paymentMetadata ?? {})?.receipts?.byApplication?.[
                    applicationId
                  ] ?? {}),
                  receiptNumber,
                  employerSentAt: new Date().toISOString(),
                },
              },
            },
          };
          await this.prisma.payment.update({
            where: { id: paymentId },
            data: { metadata: nextMetadata as any },
          });
          paymentMetadata = nextMetadata;
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to send receipt email to employer: ${error}`,
        );
      }
    }
  }

  /**
   * List receipts for an employer (what the employer paid), keyed by completed applications.
   * Amounts are returned in cents for mobile consistency.
   */
  async listEmployerReceipts(employerId: string): Promise<
    Array<{
      applicationId: string;
      jobId: string;
      bookingId: string | null;
      jobTitle: string;
      serviceProviderName: string;
      completedAt: string;
      currency: string;
      totalPaidAmountCents: number;
      platformFeeAmountCents: number;
      serviceProviderAmountCents: number;
      receiptNumber: string | null;
      employerReceiptSentAt: string | null;
    }>
  > {
    const applications = await this.prisma.application.findMany({
      where: {
        completedAt: { not: null },
        job: { employerId },
        payment: { is: { status: PaymentStatusDb.SUCCEEDED } },
      },
      include: {
        applicant: {
          select: { id: true, firstName: true, lastName: true },
        },
        job: {
          select: { id: true, title: true },
        },
        payment: {
          select: { id: true, currency: true, metadata: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 100,
    });

    const rows = await Promise.all(
      applications.map(async (app) => {
        let paidAmountCurrencyUnits = 0;
        try {
          const paymentStatus = await this.checkApplicationPayment(app.id);
          paidAmountCurrencyUnits = paymentStatus.paidAmount ?? 0;
        } catch (e) {
          this.logger.warn(
            `Employer receipts: failed to compute paid amount for application ${app.id}: ${e}`,
          );
        }

        const totalPaidAmountCents = Math.round(paidAmountCurrencyUnits * 100);
        const platformFeeAmountCents = Math.round(
          totalPaidAmountCents * this.getPlatformFeeFraction(),
        );
        const serviceProviderAmountCents =
          totalPaidAmountCents - platformFeeAmountCents;

        const metadata = (app.payment?.metadata ?? {}) as any;
        const receiptByApplication =
          metadata?.receipts?.byApplication?.[app.id] ?? null;
        const receiptNumber: string | null =
          receiptByApplication?.receiptNumber ?? null;
        const employerReceiptSentAt: string | null =
          receiptByApplication?.employerSentAt ?? null;

        const booking = await this.prisma.booking.findFirst({
          where: { jobId: app.jobId, jobSeekerId: app.applicantId },
          select: { id: true },
        });

        const serviceProviderName =
          `${app.applicant.firstName ?? ''} ${app.applicant.lastName ?? ''}`.trim() ||
          'Service Provider';

        return {
          applicationId: app.id,
          jobId: app.jobId,
          bookingId: booking?.id ?? null,
          jobTitle: app.job?.title ?? 'Job',
          serviceProviderName,
          completedAt: (app.completedAt ?? new Date()).toISOString(),
          currency: (app.payment?.currency ?? 'EUR').toUpperCase(),
          totalPaidAmountCents,
          platformFeeAmountCents,
          serviceProviderAmountCents,
          receiptNumber,
          employerReceiptSentAt,
        };
      }),
    );

    // Filter out rows where the employer hasn't paid anything (safety).
    return rows.filter((r) => r.totalPaidAmountCents > 0);
  }

  /**
   * Employer-only: resend missing employer receipt emails (idempotent).
   * This never sends service-provider receipts.
   */
  async resendMissingEmployerReceipts(employerId: string): Promise<{
    total: number;
    attempted: number;
    sent: number;
    skipped: number;
    errors: number;
  }> {
    const employer = await this.prisma.user.findUnique({
      where: { id: employerId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!employer) {
      throw new NotFoundException('Employer not found');
    }

    const applications = await this.prisma.application.findMany({
      where: {
        completedAt: { not: null },
        job: { employerId },
        payment: { is: { status: PaymentStatusDb.SUCCEEDED } },
      },
      include: {
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        job: {
          select: { id: true, title: true, employerId: true },
        },
        payment: {
          select: { id: true, currency: true, metadata: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 100,
    });

    let attempted = 0;
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const app of applications) {
      const paymentMetadata = (app.payment?.metadata ?? {}) as any;
      const existing =
        paymentMetadata?.receipts?.byApplication?.[app.id] ?? undefined;
      const alreadySent = !!existing?.employerSentAt;
      if (alreadySent) {
        skipped++;
        continue;
      }

      let paidAmountCurrencyUnits = 0;
      try {
        const paymentStatus = await this.checkApplicationPayment(app.id);
        paidAmountCurrencyUnits = paymentStatus.paidAmount ?? 0;
      } catch (e) {
        this.logger.warn(
          `Resend employer receipts: failed to compute paid amount for application ${app.id}: ${e}`,
        );
      }

      if (!paidAmountCurrencyUnits || paidAmountCurrencyUnits <= 0) {
        skipped++;
        continue;
      }

      attempted++;

      const totalAmount = paidAmountCurrencyUnits;
      const platformFee =
        Math.round(totalAmount * this.getPlatformFeeFraction() * 100) / 100;
      const serviceProviderAmount =
        Math.round((totalAmount - platformFee) * 100) / 100;

      const currency = (app.payment?.currency ?? 'EUR').toUpperCase();
      const completedAt = (app.completedAt ?? new Date()) as Date;

      try {
        await this.sendReceiptEmails(
          app.id,
          app,
          employer,
          totalAmount,
          serviceProviderAmount,
          platformFee,
          currency,
          null,
          completedAt,
          { sendEmployer: true, sendServiceProvider: false },
        );
        sent++;
      } catch (e) {
        errors++;
        this.logger.error(
          `Resend employer receipts: failed for application ${app.id}: ${e}`,
        );
      }
    }

    return {
      total: applications.length,
      attempted,
      sent,
      skipped,
      errors,
    };
  }

  /**
   * Send employer receipt email for jobs auto-completed with unpaid amounts.
   * This intentionally only emails the employer (no service provider payout occurred).
   */
  async sendEmployerReceiptEmailAfterAutoCompletion(
    applicationId: string,
  ): Promise<void> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            employerId: true,
          },
        },
        payment: {
          select: {
            id: true,
            currency: true,
            stripePaymentIntentId: true,
          },
        },
      },
    });

    if (!application || !application.job) return;

    const employer = await this.prisma.user.findUnique({
      where: { id: application.job.employerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
    if (!employer) return;

    const paymentCheck = await this.checkApplicationPayment(applicationId);
    const totalPaid = paymentCheck.paidAmount ?? 0;
    let currency = (application.payment?.currency ?? 'EUR').toUpperCase();

    if (application.payment?.stripePaymentIntentId) {
      try {
        const intent = await this.stripe.paymentIntents.retrieve(
          application.payment.stripePaymentIntentId,
        );
        if (intent?.currency) {
          currency = intent.currency.toUpperCase();
        }
      } catch {
        // Best effort only; default currency is fine.
      }
    }

    if (totalPaid <= 0) return;

    await this.sendReceiptEmails(
      applicationId,
      application,
      employer,
      totalPaid,
      0,
      0,
      currency,
      null,
      application.completedAt ?? new Date(),
      { sendEmployer: true, sendServiceProvider: false },
    );
  }

  /**
   * Generate professional receipt HTML (Uber/Bolt style)
   */
  private generateReceiptHtml(params: {
    receiptNumber: string;
    recipientName: string;
    recipientType: 'employer' | 'service_provider';
    jobTitle: string;
    otherPartyName: string;
    serviceDate: string;
    paymentDate: string;
    subtotal: number;
    platformFee: number;
    total: number;
    currency: string;
    transferId: string | null;
    isServiceProvider: boolean;
    t: (key: string, params?: any) => string;
  }): string {
    const {
      receiptNumber,
      recipientName,
      recipientType,
      jobTitle,
      otherPartyName,
      serviceDate,
      paymentDate,
      subtotal,
      platformFee,
      total,
      currency,
      transferId,
      isServiceProvider,
      t,
    } = params;

    const normalizedCurrency = currency?.toUpperCase?.() ?? currency;
    const currencySymbol =
      normalizedCurrency === 'EUR'
        ? '€'
        : normalizedCurrency === 'USD'
          ? '$'
          : normalizedCurrency;
    const formatAmount = (amount: number) =>
      `${currencySymbol}${amount.toFixed(2)}`;

    return `
      <div style="background-color: #0D1A30; padding: 32px; border-radius: 8px; border: 1px solid #1E3048;">
        <!-- Receipt Header -->
        <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #C9963F;">
          <h2 style="margin: 0 0 8px; color: #F5E6C8; font-size: 24px; font-weight: 700;">${t('email.receipts.receipt')}</h2>
          <p style="margin: 0; color: #8B7A5E; font-size: 14px; font-weight: 600;">${receiptNumber}</p>
        </div>

        <!-- Service Details -->
        <div style="margin-bottom: 32px;">
          <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.receipts.serviceDetails')}</h3>
          <div style="background-color: #0E1B32; padding: 20px; border-radius: 8px;">
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 4px; color: #8B7A5E; font-size: 14px; font-weight: 500;">${t('email.receipts.service')}</p>
              <p style="margin: 0; color: #F5E6C8; font-size: 16px; font-weight: 600;">${jobTitle}</p>
            </div>
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 4px; color: #8B7A5E; font-size: 14px; font-weight: 500;">${isServiceProvider ? t('email.common.employer') : t('email.common.serviceProvider')}</p>
              <p style="margin: 0; color: #F5E6C8; font-size: 16px;">${otherPartyName}</p>
            </div>
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 4px; color: #8B7A5E; font-size: 14px; font-weight: 500;">${t('email.receipts.serviceDate')}</p>
              <p style="margin: 0; color: #F5E6C8; font-size: 16px;">${serviceDate}</p>
            </div>
            <div>
              <p style="margin: 0 0 4px; color: #8B7A5E; font-size: 14px; font-weight: 500;">${t('email.receipts.paymentDate')}</p>
              <p style="margin: 0; color: #F5E6C8; font-size: 16px;">${paymentDate}</p>
            </div>
          </div>
        </div>

        <!-- Payment Breakdown -->
        <div style="margin-bottom: 32px;">
          <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.receipts.paymentBreakdown')}</h3>
          <div style="border: 1px solid #1E3048; border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background-color: #0E1B32;">
                <td style="padding: 16px; color: #B8A88A; font-size: 15px; border-bottom: 1px solid #1E3048;">${t('email.receipts.subtotal')}</td>
                <td style="padding: 16px; text-align: right; color: #F5E6C8; font-size: 15px; font-weight: 600; border-bottom: 1px solid #1E3048;">${formatAmount(subtotal)}</td>
              </tr>
              ${
                platformFee > 0 && !isServiceProvider
                  ? `
              <tr>
                <td style="padding: 16px; color: #B8A88A; font-size: 15px; border-bottom: 1px solid #1E3048;">${t('email.receipts.platformFee', { percentage: String(this.getPlatformFeePercent()) })}</td>
                <td style="padding: 16px; text-align: right; color: #F5E6C8; font-size: 15px; font-weight: 600; border-bottom: 1px solid #1E3048;">${formatAmount(platformFee)}</td>
              </tr>
              `
                  : ''
              }
              <tr style="background-color: rgba(16, 185, 129, 0.08); border-top: 2px solid #10b981;">
                <td style="padding: 16px; color: #F5E6C8; font-size: 18px; font-weight: 700;">${t('email.receipts.total')}</td>
                <td style="padding: 16px; text-align: right; color: #F5E6C8; font-size: 18px; font-weight: 700;">${formatAmount(total)}</td>
              </tr>
            </table>
          </div>
        </div>

        ${
          isServiceProvider && transferId
            ? `
        <!-- Payout Information -->
        <div style="margin-bottom: 32px; padding: 20px; background-color: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 4px solid #60a5fa;">
          <p style="margin: 0 0 8px; color: #60a5fa; font-size: 14px; font-weight: 600;">${t('email.receipts.payoutInformation')}</p>
          <p style="margin: 0; color: #93c5fd; font-size: 14px; line-height: 1.6;">
            ${t('email.receipts.payoutMessage', { amount: formatAmount(total), transferId })}
          </p>
          <p style="margin: 8px 0 0; color: #93c5fd; font-size: 13px; line-height: 1.6;">
            ${t('email.receipts.payoutTimeline')}
          </p>
        </div>
        `
            : ''
        }

        <!-- Footer Note -->
        <div style="padding: 20px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
          <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
            ${t('email.receipts.footerNote')}
          </p>
        </div>
      </div>
    `;
  }
}
