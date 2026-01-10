import { Module, forwardRef } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [NotificationsModule, forwardRef(() => PaymentsModule)],
  controllers: [BookingsController],
  providers: [BookingsService, PrismaService, AvailabilityService, RolesGuard],
  exports: [BookingsService],
})
export class BookingsModule {}
