import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  DeletionRequestDto,
  AdminReviewDeletionDto,
} from './dto/deletion-request.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminCapabilityGuard } from '../auth/guards/admin-capability.guard';
import { RequireCapability } from '../auth/decorators/require-capability.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SendReferralDto } from './dto/send-referral.dto';
import { ReferToJobDto } from './dto/refer-to-job.dto';

@Controller('admin/users')
@Public()
@UseGuards(AdminJwtGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(
    @Query('role') role?: 'JOB_SEEKER' | 'EMPLOYER',
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.listUsers({
      role,
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      search,
    });
  }

  @Patch(':id')
  async adminUpdateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.usersService.updateUserAdmin(id, dto);
  }

  @Get(':id')
  async getUserDetails(@Param('id') id: string) {
    return this.usersService.getUserDetailsForAdmin(id);
  }

  @Post(':id/legal-action')
  async recordLegalAction(
    @Param('id') id: string,
    @Body() dto: { actionType: string; reason: string },
  ) {
    return this.usersService.recordLegalAction(id, dto);
  }

  @Post(':id/warnings')
  async issueWarning(
    @Param('id') id: string,
    @Body() dto: { warningType: string; message: string },
  ) {
    return this.usersService.issueWarning(id, dto);
  }

  @Post(':id/action-form')
  async submitActionForm(
    @Param('id') id: string,
    @Body() dto: { actionType: string; details: string },
  ) {
    return this.usersService.submitActionForm(id, dto);
  }

  @Post(':id/request-info')
  async requestInfo(
    @Param('id') id: string,
    @Body() dto: { request: string },
  ) {
    return this.usersService.requestInfo(id, dto);
  }

  @Get(':id/actions')
  async getUserActions(@Param('id') id: string) {
    return this.usersService.getUserActions(id);
  }

  @Delete(':id/actions/:actionId')
  async revokeAction(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
  ) {
    return this.usersService.revokeAction(id, actionId);
  }

  @Delete(':id')
  @UseGuards(AdminCapabilityGuard)
  @RequireCapability('SUPER_ADMIN')
  async adminDeleteUser(@Param('id') id: string) {
    return this.usersService.deleteUserAdmin(id);
  }

  // Deletion request review endpoints
  @Get('deletion-requests')
  @UseGuards(AdminCapabilityGuard)
  @RequireCapability('DELETION_REQUEST_REVIEWER')
  async listDeletionRequests(
    @Req() req: Request,
    @Query('scope') scope: 'all' | 'mine' | 'unassigned' = 'all',
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'DENIED',
  ): Promise<unknown> {
    const admin = req.user as { id: string; adminCapabilities?: string[] };
    const isSuperAdmin = (admin.adminCapabilities || []).includes(
      'SUPER_ADMIN',
    );
    return this.usersService.listDeletionRequestsScoped(
      admin.id,
      isSuperAdmin,
      scope,
      status,
    );
  }

  @Post('deletion-requests/:id/approve')
  @UseGuards(AdminCapabilityGuard)
  @RequireCapability('DELETION_REQUEST_REVIEWER')
  async approveDeletion(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AdminReviewDeletionDto,
  ) {
    const admin = req.user as { id: string };
    return this.usersService.reviewDeletionRequest(
      admin.id,
      id,
      'APPROVED',
      dto,
    );
  }

  @Post('deletion-requests/:id/deny')
  @UseGuards(AdminCapabilityGuard)
  @RequireCapability('DELETION_REQUEST_REVIEWER')
  async denyDeletion(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AdminReviewDeletionDto,
  ) {
    const admin = req.user as { id: string };
    return this.usersService.reviewDeletionRequest(admin.id, id, 'DENIED', dto);
  }

  @Post('deletion-requests/:id/assign')
  @UseGuards(AdminCapabilityGuard)
  @RequireCapability('DELETION_REQUEST_REVIEWER')
  async assignDeletion(@Req() req: Request, @Param('id') id: string) {
    const admin = req.user as { id: string };
    return this.usersService.assignDeletionRequest(admin.id, id);
  }

  @Post('deletion-requests/:id/unassign')
  @UseGuards(AdminCapabilityGuard)
  @RequireCapability('DELETION_REQUEST_REVIEWER')
  async unassignDeletion(@Req() req: Request, @Param('id') id: string) {
    const admin = req.user as { id: string; adminCapabilities?: string[] };
    const isSuperAdmin = (admin.adminCapabilities || []).includes(
      'SUPER_ADMIN',
    );
    return this.usersService.unassignDeletionRequest(
      admin.id,
      id,
      isSuperAdmin,
    );
  }
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  async searchUsers(@Req() req: Request, @Query('q') query: string) {
    const user = req.user as { id: string };
    if (!query || query.trim().length < 2) {
      return { users: [] };
    }
    return this.usersService.searchUsers(query.trim(), user.id);
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() dto: UpdateMeDto) {
    const user = req.user as { id: string };
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('me/deletion-request')
  async requestDeletion(@Req() req: Request, @Body() dto: DeletionRequestDto) {
    const user = req.user as { id: string };
    return this.usersService.requestDeletion(user.id, dto);
  }

  @Patch('me/address')
  async updateAddress(@Req() req: Request, @Body() dto: UpdateAddressDto) {
    const user = req.user as { id: string };
    return await this.usersService.updateAddress(user.id, dto);
  }

  @Get('candidates')
  async getCandidates(@Query('skill') skill?: string) {
    return this.usersService.getVerifiedCandidates({ skill });
  }

  @Get('candidates/:id')
  async getCandidateProfile(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string; role?: string };
    // Pass employerId if the requester is an employer
    const employerId = user.role === 'EMPLOYER' ? user.id : undefined;
    return this.usersService.getCandidateProfile(id, employerId);
  }

  @Get('skills')
  async getSkills() {
    return this.usersService.getAllSkills();
  }

  @Post('me/referral')
  async sendReferral(@Req() req: Request, @Body() dto: SendReferralDto) {
    const user = req.user as { id: string };
    return this.usersService.sendReferralInvite(user.id, dto);
  }

  @Post('candidates/:id/refer-to-job')
  async referCandidateToJob(
    @Req() req: Request,
    @Param('id') candidateId: string,
    @Body() dto: ReferToJobDto,
  ) {
    const user = req.user as { id: string };
    return this.usersService.referCandidateToJob(user.id, candidateId, dto);
  }

  @Get('me/actions')
  async getMyActions(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.usersService.getUserActions(user.id);
  }

  @Post('me/legal/accept-terms')
  async acceptTerms(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.usersService.acceptLegalDocument(user.id, 'terms');
  }

  @Post('me/legal/accept-privacy')
  async acceptPrivacy(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.usersService.acceptLegalDocument(user.id, 'privacy');
  }

  @Post('me/legal/accept-platform-rules')
  async acceptPlatformRules(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.usersService.acceptLegalDocument(user.id, 'platform_rules');
  }

  @Post('me/legal/accept-cookies')
  async acceptCookies(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.usersService.acceptLegalDocument(user.id, 'cookies');
  }

  @Get('me/legal/status')
  async getLegalStatus(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.usersService.getLegalAcceptanceStatus(user.id);
  }
}
