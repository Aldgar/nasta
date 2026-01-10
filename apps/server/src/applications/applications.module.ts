import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { ApplicationsService } from './applications.service';
import {
  ApplicationsController,
  AdminApplicationsController,
  SeekerApplicationsController,
} from './applications.controller';

@Module({
  imports: [PrismaModule, NotificationsModule, BookingsModule, PaymentsModule],
  controllers: [
    ApplicationsController,
    AdminApplicationsController,
    SeekerApplicationsController,
  ],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
