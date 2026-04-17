import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KycFileUploadService } from './file-upload.service';
import { DiditVerificationService } from './didit-verification.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycExpirySchedulerService } from './kyc-expiry-scheduler.service';
import { DiditWebhookController } from './didit-webhook.controller';
import { DiditWebhookService } from './didit-webhook.service';

@Module({
  imports: [PrismaModule, NotificationsModule, ConfigModule],
  controllers: [KycController, DiditWebhookController],
  providers: [
    KycService,
    KycFileUploadService,
    DiditVerificationService,
    KycExpirySchedulerService,
    DiditWebhookService,
  ],
  exports: [KycService],
})
export class KycModule {}
