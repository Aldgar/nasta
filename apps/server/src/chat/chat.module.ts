import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { ChatFileUploadService } from './chat-file-upload.service';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService, ChatFileUploadService],
  exports: [ChatService, ChatFileUploadService],
})
export class ChatModule {}
