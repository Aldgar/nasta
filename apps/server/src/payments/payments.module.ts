import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookAliasController } from './payments.webhook-alias.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RatingsModule } from '../ratings/ratings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificationsModule,
    RatingsModule,
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController, PaymentsWebhookAliasController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
