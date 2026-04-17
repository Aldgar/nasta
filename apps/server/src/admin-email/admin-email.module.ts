import { Module } from '@nestjs/common';
import { AdminEmailController } from './admin-email.controller';
import { AdminEmailService } from './admin-email.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  controllers: [AdminEmailController],
  providers: [AdminEmailService],
  exports: [AdminEmailService],
})
export class AdminEmailModule {}
