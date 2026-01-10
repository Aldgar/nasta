import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminCapabilityGuard } from '../auth/guards/admin-capability.guard';
import { RequireCapability } from '../auth/decorators/require-capability.decorator';
import { Public } from '../auth/decorators/public.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

type VerificationType =
  | 'GOVERNMENT_ID'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'NATIONAL_ID'
  | 'RESIDENCE_PERMIT';

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  // User: initiate a KYC verification
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate KYC verification' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['verificationType', 'consent'],
      properties: {
        verificationType: {
          type: 'string',
          enum: [
            'GOVERNMENT_ID',
            'PASSPORT',
            'DRIVERS_LICENSE',
            'NATIONAL_ID',
            'RESIDENCE_PERMIT',
          ],
        },
        consent: {
          type: 'object',
          required: ['accepted'],
          properties: {
            accepted: { type: 'boolean' },
            version: { type: 'string' },
            textHash: { type: 'string' },
          },
        },
      },
    },
  })
  async initiate(
    @Request() req: { user: { id: string } },
    @Body('verificationType') verificationType: VerificationType,
    @Body('consent')
    consent?: {
      accepted: boolean;
      version?: string;
      textHash?: string;
    },
  ) {
    if (!verificationType) {
      throw new BadRequestException('verificationType is required');
    }
    if (!consent || consent.accepted !== true) {
      throw new BadRequestException(
        'Consent is required to proceed with ID verification',
      );
    }
    return this.kycService.initiate(req.user.id, verificationType, consent);
  }

  // User: upload KYC documents (front/back/selfie)
  @Post(':verificationId/upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload KYC documents (front/back/selfie)' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'documentFront', maxCount: 1 },
      { name: 'documentBack', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
  )
  async upload(
    @Param('verificationId') verificationId: string,
    @Request() req: { user: { id: string } },
    @UploadedFiles()
    files: {
      documentFront?: Express.Multer.File[];
      documentBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
  ) {
    const payload = {
      documentFront: files.documentFront?.[0],
      documentBack: files.documentBack?.[0],
      selfie: files.selfie?.[0],
    };
    return this.kycService.uploadDocuments(
      verificationId,
      req.user.id,
      payload,
    );
  }

  // User: upload certification
  @Post(':verificationId/upload-certification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload certification document' })
  @UseInterceptors(FileInterceptor('certification'))
  async uploadCertification(
    @Param('verificationId') verificationId: string,
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kycService.uploadCertification(
      verificationId,
      req.user.id,
      file,
    );
  }

  // User: upload CV
  @Post(':verificationId/upload-cv')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload CV document' })
  @UseInterceptors(FileInterceptor('cv'))
  async uploadCv(
    @Param('verificationId') verificationId: string,
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kycService.uploadCv(
      verificationId,
      req.user.id,
      file,
    );
  }

  // User: set KYC document details (number/country/expiry)
  @Post(':verificationId/details')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set KYC document details (number/country/expiry)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentNumber: { type: 'string' },
        documentCountry: { type: 'string', description: 'ISO country code' },
        documentExpiry: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiOkResponse({ description: 'Document details saved' })
  async setDetails(
    @Param('verificationId') verificationId: string,
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      documentNumber?: string;
      documentCountry?: string;
      documentExpiry?: string;
    },
  ) {
    return this.kycService.setDocumentDetails(
      verificationId,
      req.user.id,
      body,
    );
  }

  // User: get my current KYC status
  @Get('my-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my current KYC status' })
  async myStatus(@Request() req: { user: { id: string } }) {
    return this.kycService.myStatus(req.user.id);
  }

  // Admin: list verifications in queue
  @Get('admin/list')
  @Public()
  @UseGuards(AdminJwtGuard)
  async adminList(@Query('statuses') statuses?: string | string[]) {
    const defaults: Array<'PENDING' | 'IN_PROGRESS' | 'MANUAL_REVIEW'> = [
      'PENDING',
      'IN_PROGRESS',
      'MANUAL_REVIEW',
    ];
    const parsed = (() => {
      if (!statuses) return defaults;
      const arr = Array.isArray(statuses)
        ? statuses
        : String(statuses).split(',');
      const allowed = ['PENDING', 'IN_PROGRESS', 'MANUAL_REVIEW'] as const;
      type AllowedStatus = (typeof allowed)[number];
      const safe = arr
        .map((s) => s.trim().toUpperCase())
        .filter((s): s is AllowedStatus =>
          (allowed as readonly string[]).includes(s),
        );
      return safe.length ? safe : defaults;
    })();
    return this.kycService.adminList(parsed);
  }

  // Admin: get verification details
  @Get('admin/:verificationId')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin get KYC verification details' })
  async adminGetVerification(@Param('verificationId') verificationId: string) {
    return this.kycService.adminGetVerification(verificationId);
  }

  // Admin: review a verification
  @Post('admin/:verificationId/review')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin review KYC verification' })
  async adminReview(
    @Param('verificationId') verificationId: string,
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      decision: 'VERIFIED' | 'FAILED';
      notes?: string;
      confidence?: number;
    },
  ) {
    return this.kycService.adminReview(verificationId, req.user.id, body);
  }

  // Admin: request additional documents
  @Post('admin/:verificationId/request-documents')
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('BACKGROUND_CHECK_REVIEWER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin request additional documents for KYC' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['requestedDocument', 'reason'],
      properties: {
        requestedDocument: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  })
  async requestAdditionalDocuments(
    @Param('verificationId') verificationId: string,
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      requestedDocument: string;
      reason: string;
    },
  ) {
    return this.kycService.requestAdditionalDocuments(
      verificationId,
      req.user.id,
      body,
    );
  }

  // Admin: review individual document
  @Post('admin/:verificationId/document/:documentType/review')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin review individual document' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['decision'],
      properties: {
        decision: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
        notes: { type: 'string' },
      },
    },
  })
  async reviewDocument(
    @Param('verificationId') verificationId: string,
    @Param('documentType') documentType: string,
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      decision: 'APPROVED' | 'REJECTED';
      notes?: string;
    },
  ) {
    return this.kycService.reviewDocument(
      verificationId,
      documentType,
      req.user.id,
      body,
    );
  }

  // Admin: request specific document
  @Post('admin/:verificationId/document/:documentType/request')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin request specific document' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string' },
      },
    },
  })
  async requestDocument(
    @Param('verificationId') verificationId: string,
    @Param('documentType') documentType: string,
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      reason: string;
    },
  ) {
    return this.kycService.requestDocument(
      verificationId,
      documentType,
      req.user.id,
      body,
    );
  }
}
