import {
  Controller,
  Post,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('admin-dev')
@Controller('admin/dev')
@Public()
@UseGuards(AdminJwtGuard)
export class DevController {
  constructor(private prisma: PrismaService) {}

  @Post('seed-minimal')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seed minimal taxonomy for testing (categories)' })
  async seedMinimal() {
    // Upsert a general category and a driving category
    const general = await this.prisma.jobCategory.upsert({
      where: { name: 'General Labor' },
      update: {},
      create: { name: 'General Labor', description: 'General purpose work' },
      select: { id: true, name: true, requiresDriverLicense: true },
    });
    const driving = await this.prisma.jobCategory.upsert({
      where: { name: 'Driving' },
      update: { requiresDriverLicense: true },
      create: {
        name: 'Driving',
        description: 'Driving-related jobs',
        requiresDriverLicense: true,
      },
      select: { id: true, name: true, requiresDriverLicense: true },
    });

    return {
      message: 'Seeded minimal categories',
      categories: {
        generalLaborId: general.id,
        drivingId: driving.id,
      },
    };
  }

  @Get('last-phone-otp')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch latest unconsumed PHONE OTP by user email (dev only)',
  })
  async getLastPhoneOtp(
    @Query('email') email?: string,
    @Query('userId') userId?: string,
  ) {
    let uid = userId;
    if (!uid) {
      if (!email) throw new BadRequestException('email or userId is required');
      const u = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!u) throw new BadRequestException('User not found for given email');
      uid = u.id;
    }
    const rec = await this.prisma.verificationToken.findFirst({
      where: { userId: uid, type: 'PHONE', consumed: false },
      orderBy: { expiresAt: 'desc' },
      select: { token: true, expiresAt: true },
    });
    if (!rec) throw new BadRequestException('No active OTP found');
    return { code: rec.token, expiresAt: rec.expiresAt };
  }
}
