import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ProfilesService } from './profiles.service';
import {
  UpdateUserAddressDto,
  UpdateUserProfileDto,
} from './dto/user-profile.dto';
import {
  UpdateEmployerAddressDto,
  UpdateEmployerProfileDto,
} from './dto/employer-profile.dto';
import { UpdateAdminProfileDto } from './dto/admin-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileFileUploadService } from './profile-file-upload.service';
import { profileUploadConfig } from './config/file-upload.config';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly uploadService: ProfileFileUploadService,
  ) {}

  // Job seeker endpoints
  @Get('me')
  async me(@Req() req: Request) {
    const user = req.user as { id: string; role?: string };
    // If user is an admin, return admin profile instead
    if (user.role === 'ADMIN') {
      return this.profilesService.getAdminProfile(user.id);
    }
    return this.profilesService.getUserProfile(user.id);
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() dto: UpdateUserProfileDto) {
    const user = req.user as { id: string };
    return this.profilesService.updateUserProfile(user.id, dto);
  }

  @Patch('me/address')
  async updateMyAddress(
    @Req() req: Request,
    @Body() dto: UpdateUserAddressDto,
  ) {
    const user = req.user as { id: string };
    return this.profilesService.updateUserAddress(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: profileUploadConfig.maxFileSize },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  async uploadMyAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send multipart/form-data with field name "file".',
      );
    }
    const user = req.user as { id: string };
    const url = await this.uploadService.saveAvatar(file);
    return this.profilesService.updateUserProfile(user.id, {
      avatarUrl: url,
    });
  }

  // Employer endpoints
  @Get('employer/me')
  async employerMe(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.profilesService.getEmployerProfile(user.id);
  }

  @Patch('employer/me')
  async updateEmployerMe(
    @Req() req: Request,
    @Body() dto: UpdateEmployerProfileDto,
  ) {
    const user = req.user as { id: string };
    return this.profilesService.updateEmployerProfile(user.id, dto);
  }

  @Patch('employer/me/address')
  async updateEmployerAddress(
    @Req() req: Request,
    @Body() dto: UpdateEmployerAddressDto,
  ) {
    const user = req.user as { id: string };
    return this.profilesService.updateEmployerAddress(user.id, dto);
  }

  @Post('employer/me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: profileUploadConfig.maxFileSize },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  async uploadEmployerAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send multipart/form-data with field name "file".',
      );
    }
    const user = req.user as { id: string };
    const url = await this.uploadService.saveAvatar(file);
    return this.profilesService.updateEmployerProfile(user.id, {
      logoUrl: url,
    });
  }

  @Post('onboarding')
  async onboarding(
    @Req() req: Request,
    @Body()
    dto: {
      aboutMe: string;
      hourlyRate: number; // Keep for backward compatibility
      yearsExperience: number;
      languages: string[];
      skills: string[];
      cvUrl?: string;
      categories?: string[];
      rates?: Array<{
        rate: number;
        description?: string;
        paymentType: string;
        otherSpecification?: string;
      }>;
    },
  ) {
    const user = req.user as { id: string };
    return this.profilesService.completeOnboarding(user.id, dto);
  }
}

@ApiTags('admin-profile')
@ApiBearerAuth()
@Controller('admin/profile')
@Public()
@UseGuards(AdminJwtGuard)
export class AdminProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly uploadService: ProfileFileUploadService,
  ) {}

  @Get()
  async me(@Req() req: Request) {
    const admin = req.user as { id: string };
    return this.profilesService.getAdminProfile(admin.id);
  }

  @Patch()
  async update(@Req() req: Request, @Body() dto: UpdateAdminProfileDto) {
    const admin = req.user as { id: string };
    return this.profilesService.updateAdminProfile(admin.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: profileUploadConfig.maxFileSize },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async uploadAdminAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send multipart/form-data with field name "file".',
      );
    }
    const admin = req.user as { id: string };
    const url = await this.uploadService.saveAvatar(file);
    return this.profilesService.updateAdminProfile(admin.id, {
      avatarUrl: url,
    });
  }
}
