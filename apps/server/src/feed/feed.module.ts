import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { AdminFeedController } from './feed.admin.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [FeedController, AdminFeedController],
  providers: [FeedService],
})
export class FeedModule {}
