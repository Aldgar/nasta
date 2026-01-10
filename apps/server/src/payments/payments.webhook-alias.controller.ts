import { Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

// Some infra setups route the API under /api/*.
// These alias endpoints ensure Stripe doesn't get a 404 due to path mismatches.
@Controller('api/payments')
export class PaymentsWebhookAliasController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhook')
  async webhook(
    @Req() req: Request & { body: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.payments.handleWebhook(req.body as Buffer, signature);
  }

  @Post('webhooks/stripe')
  async webhookStripeAlias(
    @Req() req: Request & { body: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.payments.handleWebhook(req.body as Buffer, signature);
  }
}
