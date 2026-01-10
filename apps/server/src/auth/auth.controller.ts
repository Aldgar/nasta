import {
  Controller,
  Post,
  Patch,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  AdminLoginDto,
  AdminSelfRegisterDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { Public } from './decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { VerificationRequestDto, PhoneVerificationDto } from './dto/verify.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/password.dto';
import {
  RequestEmailChangeDto,
  ConfirmEmailChangeDto,
} from './dto/email-change.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { RequireCapability } from './decorators/require-capability.decorator';
import { AdminCreateDto } from './dto/admin-create.dto';
import { AdminSetCapabilitiesDto } from './dto/admin-set-caps.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Res, Req } from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { ConfigService } from '@nestjs/config';

// Authenticated user shape attached by JwtStrategy
// If you centralize types later, move it to a shared types file.
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Public: Register new user
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 3 } }) // stricter per-route limit
  @Post('register')
  async register(@Body() dto: RegisterDto, @Request() req: any) {
    const languageHint =
      (req?.headers?.['x-app-language'] as string | undefined) ??
      (req?.headers?.['accept-language'] as string | undefined);
    return await this.authService.register(dto, languageHint);
  }

  // Note: Admin registration is managed internally by existing admins or ops. No public endpoint.
  // Public: First-admin-only registration (no bootstrap, DB-gated)
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 1 } })
  @Post('admin/register')
  async adminRegister(@Body() dto: AdminSelfRegisterDto) {
    return await this.authService.adminSelfRegister(dto);
  }

  // Public: User login
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 5 } }) // stricter per-route limit
  @Post('login')
  async login(@Body() dto: LoginDto, @Request() req: any) {
    const languageHint =
      (req?.headers?.['x-app-language'] as string | undefined) ??
      (req?.headers?.['accept-language'] as string | undefined);
    return await this.authService.login(dto, languageHint);
  }

  // Public: Job seeker login (distinct endpoint)
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 5 } })
  @Post('user/login')
  async userLogin(@Body() dto: LoginDto, @Request() req: any) {
    const languageHint =
      (req?.headers?.['x-app-language'] as string | undefined) ??
      (req?.headers?.['accept-language'] as string | undefined);
    return await this.authService.userLogin(dto, languageHint);
  }

  // Public: Employer login (distinct endpoint)
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 5 } })
  @Post('employer/login')
  async employerLogin(@Body() dto: LoginDto, @Request() req: any) {
    const languageHint =
      (req?.headers?.['x-app-language'] as string | undefined) ??
      (req?.headers?.['accept-language'] as string | undefined);
    return await this.authService.employerLogin(dto, languageHint);
  }

  // Public: Admin login
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 5 } }) // stricter per-route limit
  @Post('admin/login')
  async adminLogin(@Body() dto: AdminLoginDto) {
    return await this.authService.adminLogin(dto);
  }

  // Admin-only: Create another admin (all admins can create)
  @Post('admin/create')
  @Public()
  @UseGuards(AdminJwtGuard)
  async createAdmin(@Body() dto: AdminCreateDto) {
    return await this.authService.createAdmin(dto);
  }

  // Admin-only: Set capabilities for an admin (SUPER_ADMIN required)
  @Public()
  @UseGuards(AdminJwtGuard, AdminCapabilityGuard)
  @RequireCapability('SUPER_ADMIN')
  @Patch('admin/:adminId/capabilities')
  async setAdminCapabilities(
    @Param('adminId') adminId: string,
    @Body() dto: AdminSetCapabilitiesDto,
  ) {
    // Allow SUPER_ADMINs to assign multiple roles (capabilities) to any admin
    return await this.authService.setAdminCapabilities(adminId, dto);
  }

  // Admin-only: List admins (all admins can list)
  @Public()
  @UseGuards(AdminJwtGuard)
  @Get('admin/list')
  async listAdmins() {
    return await this.authService.listAdmins();
  }

  // Admin-only: Delete an admin (all admins can delete, but SUPER_ADMIN can only be deleted by SUPER_ADMIN)
  @Public()
  @UseGuards(AdminJwtGuard)
  @Post('admin/:adminId/delete')
  async deleteAdmin(
    @Param('adminId') adminId: string,
    @Request() req: { user: { id: string; adminCapabilities?: string[] } },
  ) {
    return await this.authService.deleteAdmin(
      adminId,
      req.user.id,
      req.user.adminCapabilities || [],
    );
  }

  // Protected: Get current user profile
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(
    @Request()
    req: {
      user: AuthUser;
    },
  ) {
    return {
      user: req.user,
      message: 'User profile retrieved successfully',
    };
  }

  // Protected: Admin only - Get current admin profile
  @Get('admin/profile')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'DEPRECATED: use GET /auth/admin/whoami for identity claims or /admin/profile for admin profile CRUD',
    description:
      'Returns the authenticated admin identity attached by AdminJwtGuard. This endpoint is deprecated in favor of /auth/admin/whoami (claims-only) and /admin/profile (domain profile CRUD).',
    deprecated: true,
  })
  getAdminProfile(
    @Request()
    req: {
      user: AuthUser;
    },
  ) {
    return {
      admin: req.user,
      message:
        'DEPRECATED endpoint: prefer /auth/admin/whoami for identity or /admin/profile for CRUD',
    };
  }

  // Protected: Admin only - Whoami (identity claims only; not domain profile)
  @Get('admin/whoami')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin whoami: returns identity claims only (not profile data).',
    description:
      'Use this endpoint to retrieve the authenticated admin identity claims attached by AdminJwtGuard. For profile CRUD (bio, avatar, address), use /admin/profile endpoints.',
  })
  @ApiOkResponse({ description: 'Admin identity claims returned.' })
  whoami(
    @Request()
    req: {
      user: AuthUser;
    },
  ) {
    return {
      admin: req.user,
      message: 'Admin identity (whoami)',
    };
  }

  // Protected: Validate token (useful for frontend)
  @Get('validate')
  @UseGuards(JwtAuthGuard)
  validateToken(
    @Request()
    req: {
      user: AuthUser;
    },
  ) {
    return {
      valid: true,
      user: req.user,
      message: 'Token is valid',
    };
  }

  // Request email verification
  @Post('email/request-verify')
  @UseGuards(JwtAuthGuard)
  async requestEmailVerification(@Request() req: { user: { id: string } }) {
    return this.authService.requestEmailVerification(req.user.id);
  }

  // Verify email via token
  @Public()
  @Post('email/verify')
  async verifyEmail(@Body() dto: VerificationRequestDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // Request phone verification (send OTP)
  @Post('phone/request-verify')
  @UseGuards(JwtAuthGuard)
  async requestPhoneVerification(@Request() req: { user: { id: string } }) {
    return this.authService.requestPhoneVerification(req.user.id);
  }

  // Verify phone with OTP
  @Post('phone/verify')
  @UseGuards(JwtAuthGuard)
  async verifyPhone(
    @Request() req: { user: { id: string } },
    @Body() dto: PhoneVerificationDto,
  ) {
    return this.authService.verifyPhone(req.user.id, dto.code);
  }

  // Public: Request password reset
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 3 } })
  @Post('password/request-reset')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return await this.authService.requestPasswordReset(dto.email);
  }

  // Public: Reset password using token
  @Public()
  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // Authenticated: Change password
  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  async changePassword(
    @Request() req: { user: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return await this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // Authenticated: request email change
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: { ttl: 60, limit: 3 } })
  @Post('email/request-change')
  async requestEmailChange(
    @Request() req: { user: { id: string } },
    @Body() dto: RequestEmailChangeDto,
  ) {
    return await this.authService.requestEmailChange(req.user.id, dto.newEmail);
  }

  // Public: confirm email change by token
  @Public()
  @Post('email/confirm-change')
  async confirmEmailChange(@Body() dto: ConfirmEmailChangeDto) {
    return await this.authService.confirmEmailChange(dto.token);
  }
}
