import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import type { Request } from 'express';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('status') status: 'unread' | 'all' = 'all',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const user = req.user as { id: string };
    return await this.notifications.listNotifications(user.id, {
      status,
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
    });
  }

  @Post(':id/read')
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return await this.notifications.markNotificationRead(user.id, id);
  }

  @Post('read-all')
  async markAllRead(@Req() req: Request) {
    const user = req.user as { id: string };
    return await this.notifications.markAllRead(user.id);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    const user = req.user as { id: string };
    return await this.notifications.getUnreadCount(user.id);
  }

  @Post('register-token')
  async registerToken(
    @Req() req: Request,
    @Body() body: { pushToken: string; platform: string },
  ) {
    const user = req.user as { id: string };
    return await this.notifications.registerPushToken(
      user.id,
      body.pushToken,
      body.platform,
    );
  }

  @Post('unregister-token')
  async unregisterToken(@Req() req: Request) {
    const user = req.user as { id: string };
    return await this.notifications.unregisterPushToken(user.id);
  }
}
