import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KycFileUploadService } from './file-upload.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [KycController],
  providers: [KycService, KycFileUploadService],
  exports: [KycService],
})
export class KycModule {}
