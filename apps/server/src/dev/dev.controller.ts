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
    // For local fallback tokens, extract the actual code
    const code = rec.token.startsWith('local:')
      ? rec.token.slice(6)
      : rec.token;
    return { code, expiresAt: rec.expiresAt };
  }

  @Get('push-tokens')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users with push tokens (dev only)' })
  async listPushTokens() {
    const users = await this.prisma.user.findMany({
      where: { pushToken: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pushToken: true,
        pushTokenPlatform: true,
      },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`,
      pushToken: u.pushToken ? `${u.pushToken!.slice(0, 25)}...` : null,
      platform: u.pushTokenPlatform,
    }));
  }
}
