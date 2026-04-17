import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { DiditWebhookService } from './didit-webhook.service';

/**
 * Receives Didit V3 webhooks.
 *
 * Endpoint: POST /kyc/webhooks/didit
 *
 * Didit sends:
 *   X-Signature-V2  (HMAC of sorted canonical JSON)
 *   X-Signature-Simple (HMAC of core fields)
 *   X-Timestamp
 */
@ApiExcludeController()
@Controller('kyc/webhooks')
export class DiditWebhookController {
  private readonly logger = new Logger(DiditWebhookController.name);

  constructor(private readonly webhookService: DiditWebhookService) {}

  @Post('didit')
  @Public()
  @HttpCode(200)
  async handleDiditWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-signature-v2') signatureV2?: string,
    @Headers('x-signature-simple') signatureSimple?: string,
    @Headers('x-timestamp') timestamp?: string,
  ) {
    // Verify signature
    this.webhookService.validateWebhook(body, {
      signatureV2,
      signatureSimple,
      timestamp,
    });

    // Process asynchronously — respond 200 immediately
    // (NestJS still awaits, but Didit retries on 5xx so fast response is fine)
    try {
      await this.webhookService.handleWebhook(body as any);
    } catch (error) {
      // Log but don't throw — we already validated signature, so return 200
      // to prevent Didit retries for processing errors
      this.logger.error(`Error processing Didit webhook: ${error}`, error);
    }

    return { message: 'Webhook event dispatched' };
  }
}
