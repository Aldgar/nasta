import { Module } from '@nestjs/common';
import { BackgroundCheckController } from './background-check.controller';
import { BackgroundCheckService } from './background-check.service';
import { FileUploadService } from './file-upload.service'; // Add this import
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './guards/admin.guard'; // Add this import
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BackgroundCheckController],
  providers: [
    BackgroundCheckService,
    FileUploadService,
    PrismaService,
    AdminGuard,
  ],
  exports: [BackgroundCheckService], // Export so other modules can use it
})
export class BackgroundCheckModule {}
