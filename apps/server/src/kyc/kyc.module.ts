import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KycFileUploadService } from './file-upload.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycExpirySchedulerService } from './kyc-expiry-scheduler.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [KycController],
  providers: [KycService, KycFileUploadService, KycExpirySchedulerService],
  exports: [KycService],
})
export class KycModule {}
