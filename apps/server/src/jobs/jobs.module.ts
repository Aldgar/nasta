import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { AdminJobsController } from './admin-jobs.controller';
import { JobsService } from './jobs.service';
import { JobsSchedulerService } from './jobs-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerifiedForJobsGuard } from './guards/verified-for-jobs.guard';
import { ChatModule } from '../chat/chat.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, NotificationsModule, ChatModule, PaymentsModule, AuthModule],
  controllers: [JobsController, AdminJobsController],
  providers: [JobsService, JobsSchedulerService, VerifiedForJobsGuard],
  exports: [JobsService],
})
export class JobsModule {}
