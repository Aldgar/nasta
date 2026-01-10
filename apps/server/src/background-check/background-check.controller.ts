import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BackgroundCheckService } from './background-check.service';
import {
  ReviewBackgroundCheckDto,
  ConsentDto,
} from './dto/background-check.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminCapabilityGuard } from '../auth/guards/admin-capability.guard';
import { RequireCapability } from '../auth/decorators/require-capability.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import type { Request as ExpressRequest } from 'express';

@Controller('background-checks')
export class BackgroundCheckController {
  constructor(private backgroundCheckService: BackgroundCheckService) {}

  private ensureValidObjectId(id: string, name = 'id') {
    const raw = typeof id === 'string' ? id : String(id ?? '');
    const cleaned = raw.trim();
    // Friendly diagnostics for common Postman mistakes
    if (cleaned.startsWith('{{') && cleaned.endsWith('}}')) {
      throw new BadRequestException(
        `Invalid ${name} format: unresolved Postman variable ${cleaned}. Select the correct environment and ensure the variable is set.`,
      );
    }
    if (cleaned.startsWith(':')) {
      throw new BadRequestException(
        `Invalid ${name} format: it looks like a literal ":param" placeholder was sent. Replace it with a real ObjectId.`,
      );
    }
    const ok = /^[a-fA-F0-9]{24}$/.test(cleaned);
    if (!ok) {
      throw new BadRequestException(`Invalid ${name} format`);
    }
  }

  // User initiates background check
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiateBackgroundCheck(
    @Request() req: { user: { id: string } },
    @Body('consent') consent?: ConsentDto,
  ) {
    // ValidationPipe handles consent.accepted === true; keep a runtime guard just in case
    if (!consent || consent.accepted !== true) {
      throw new BadRequestException(
        'Consent is required to initiate background check',
      );
    }
    return await this.backgroundCheckService.initiate(req.user.id, consent);
  }

  // Get user's background check status
  @Get('status/:userId')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  async getBackgroundCheckStatus(@Param('userId') userId: string) {
    return await this.backgroundCheckService.getUserStatus(userId);
  }

  // Get current user's status (when we add authentication)
  @Get('my-status')
  @UseGuards(JwtAuthGuard)
  async getMyBackgroundCheckStatus(@Request() req: { user: { id: string } }) {
    const userId = req.user.id;
    return await this.backgroundCheckService.getUserStatus(userId);
  }

  // User uploads certificate document
  @Post(':checkId/upload-document')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('certificate'))
  async uploadCertificate(
    @Param('checkId') checkId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('certificateNumber') certificateNumber?: string,
  ) {
    this.ensureValidObjectId(checkId, 'checkId');
    if (!file) {
      throw new BadRequestException('Certificate file is required');
    }

    return await this.backgroundCheckService.uploadDocument(
      checkId,
      file,
      certificateNumber,
    );
  }

  // Admin: Get all pending background checks for review
  @Get('admin/pending')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  async getPendingReviews() {
    return await this.backgroundCheckService.getPendingReviews();
  }

  // Admin: Capability-scoped listing with optional filters
  @Get('admin/reviews')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  async listReviewsScoped(
    @Request() req: ExpressRequest,
    @Param('scope') scope?: 'all' | 'mine' | 'unassigned',
  ) {
    const admin = req.user as { id: string; adminCapabilities?: string[] };
    const isSuperAdmin = (admin.adminCapabilities || []).includes(
      'SUPER_ADMIN',
    );
    // Default to status in review queue
    return this.backgroundCheckService.listReviewsScoped(
      admin.id,
      isSuperAdmin,
      scope || 'all',
      'SUBMITTED',
    );
  }

  // Admin: Review and approve/reject a background check
  @Post('admin/:checkId/review')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  async reviewBackgroundCheck(
    @Param('checkId') checkId: string,
    @Body() reviewData: ReviewBackgroundCheckDto,
    @Request() req: { user: { id: string } },
  ) {
    this.ensureValidObjectId(checkId, 'checkId');
    const adminId = req.user.id;

    return await this.backgroundCheckService.reviewBackgroundCheck(
      checkId,
      adminId,
      reviewData,
    );
  }

  // Admin: Stream uploaded certificate
  @Get('admin/:checkId/certificate')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  async streamCertificateAdmin(
    @Param('checkId') checkId: string,
  ): Promise<StreamableFile> {
    this.ensureValidObjectId(checkId, 'checkId');
    const relPath =
      await this.backgroundCheckService.getCertificatePathByCheckId(checkId);
    return this.streamFileOr404(relPath);
  }

  // Admin: Assign/unassign reviews
  @Post('admin/:checkId/assign')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  async assignBackgroundCheck(
    @Param('checkId') checkId: string,
    @Request() req: { user: { id: string } },
  ) {
    this.ensureValidObjectId(checkId, 'checkId');
    return this.backgroundCheckService.assignBackgroundCheck(
      req.user.id,
      checkId,
    );
  }

  @Post('admin/:checkId/unassign')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  async unassignBackgroundCheck(
    @Param('checkId') checkId: string,
    @Request() req: ExpressRequest,
  ) {
    this.ensureValidObjectId(checkId, 'checkId');
    const admin = req.user as { id: string; adminCapabilities?: string[] };
    const isSuperAdmin = (admin.adminCapabilities || []).includes(
      'SUPER_ADMIN',
    );
    return this.backgroundCheckService.unassignBackgroundCheck(
      admin.id,
      checkId,
      isSuperAdmin,
    );
  }

  // User: Stream own certificate (ownership enforced)
  @Get('my/certificate/:checkId')
  @UseGuards(JwtAuthGuard)
  async streamMyCertificate(
    @Param('checkId') checkId: string,
    @Request() req: { user: { id: string } },
  ): Promise<StreamableFile> {
    this.ensureValidObjectId(checkId, 'checkId');
    const relPath = await this.backgroundCheckService.getCertificatePathForUser(
      checkId,
      req.user.id,
    );
    return this.streamFileOr404(relPath);
  }

  private streamFileOr404(relPath: string | null): StreamableFile {
    if (!relPath) {
      throw new NotFoundException('No certificate uploaded');
    }
    const absPath = join(process.cwd(), relPath);
    if (!existsSync(absPath)) {
      throw new NotFoundException('Certificate file not found');
    }
    const file = createReadStream(absPath);
    return new StreamableFile(file, {
      disposition: 'inline',
      type: 'application/pdf',
    });
  }
}
