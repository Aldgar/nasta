import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateDirectBookingDto } from './dto/create-direct-booking.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BookingStatus, UserRole } from '@prisma/client';

interface RequestWithUser extends Request {
  user?: { id?: string; userId?: string };
}

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @Post('direct')
  async createDirect(
    @Req() req: RequestWithUser,
    @Body() dto: CreateDirectBookingDto,
  ) {
    const employerId = String(req.user?.userId ?? req.user?.id);
    const result = await this.bookings.createDirectBooking(employerId, dto);
    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  @Get('seeker/me')
  async listMineSeeker(
    @Req() req: RequestWithUser,
    @Query('status') status?: BookingStatus,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const rows: unknown = await this.bookings.listForSeeker(userId, {
      status,
      page: Number.parseInt(page) || 1,
      pageSize: Number.parseInt(pageSize) || 20,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return rows as any;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @Get('employer/me')
  async listMineEmployer(
    @Req() req: RequestWithUser,
    @Query('status') status?: BookingStatus,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const rows: unknown = await this.bookings.listForEmployer(userId, {
      status,
      page: Number.parseInt(page) || 1,
      pageSize: Number.parseInt(pageSize) || 20,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return rows as any;
  }
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.bookings.findOne(id);
  }

  // Update booking status (e.g., start tracking)
  @UseGuards(JwtAuthGuard)
  @Post(':id/status')
  async updateStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { status: BookingStatus },
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const userRole = (req.user as any)?.role || 'JOB_SEEKER';
    return this.bookings.updateBookingStatus(id, userId, body.status, userRole);
  }

  // Delete a booking
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteBooking(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const userRole = (req.user as any)?.role || 'JOB_SEEKER';
    return await this.bookings.deleteBooking(id, userId, userRole);
  }

  // Debug endpoint to list all bookings (remove in production)
  @UseGuards(JwtAuthGuard)
  @Get('debug/all')
  async debugAllBookings(@Req() req: RequestWithUser) {
    const userId = String(req.user?.userId ?? req.user?.id);
    console.log(`[Debug] User ID from token: ${userId}`);
    const allBookings = await this.bookings.debugListAll(userId);
    return {
      userId,
      totalBookings: allBookings.length,
      bookings: allBookings,
    };
  }
}
