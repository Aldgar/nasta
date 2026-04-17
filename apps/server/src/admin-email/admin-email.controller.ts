import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminEmailService } from './admin-email.service';
import { SendAdminEmailDto } from './dto/send-email.dto';

@ApiTags('Admin Email')
@ApiBearerAuth()
@Controller('email/admin')
export class AdminEmailController {
  private readonly logger = new Logger(AdminEmailController.name);

  constructor(private readonly emailService: AdminEmailService) {}

  @Post('send')
  @UseGuards(AdminJwtGuard)
  @ApiOperation({ summary: 'Send email to a user from admin panel' })
  async send(@Body() dto: SendAdminEmailDto) {
    return this.emailService.send(dto);
  }

  @Get('threads')
  @UseGuards(AdminJwtGuard)
  @ApiOperation({ summary: 'List email threads grouped by recipient' })
  async getThreads(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.emailService.getThreads(
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Get('threads/by-user/:userId')
  @UseGuards(AdminJwtGuard)
  @ApiOperation({ summary: 'Get email thread for a specific user by ID' })
  async getThreadByUserId(@Param('userId') userId: string) {
    return this.emailService.getThreadByUserId(userId);
  }

  @Get('threads/:email')
  @UseGuards(AdminJwtGuard)
  @ApiOperation({ summary: 'Get all emails for a specific recipient' })
  async getThread(@Param('email') email: string) {
    return this.emailService.getThread(email);
  }
}
