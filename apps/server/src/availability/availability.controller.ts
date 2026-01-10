import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user?: { id?: string; userId?: string };
}

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async myAvailability(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const rows = await this.availability.listForUser(userId);
    return rows;
  }

  @UseGuards(JwtAuthGuard)
  @Post('upsert')
  async upsert(
    @Req() req: RequestWithUser,
    @Body()
    body: { id?: string; start: string; end: string; timezone?: string },
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const slot = await this.availability.upsertSlot(userId, body);
    return slot;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.availability.deleteSlot(userId, id);
  }

  // Public for employers to read seeker's availability
  @Get('user/:userId')
  async listForUser(@Param('userId') userId: string) {
    const rows = await this.availability.listForUser(userId);
    return rows;
  }
}
