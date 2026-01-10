import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminCapabilityGuard } from '../auth/guards/admin-capability.guard';
import { RequireCapability } from '../auth/decorators/require-capability.decorator';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';

type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly authService: AuthService,
  ) {}

  @Post('contact')
  @Public()
  @ApiOperation({ summary: 'Create a support ticket (public endpoint)' })
  async createTicket(
    @Body() dto: CreateSupportTicketDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.get('user-agent') || undefined;

    // Extract userId from token if present (optional auth)
    let userId: string | undefined;
    
    try {
      // Manually extract and validate token from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const user = await this.authService.validateToken(token);
          if (user?.id) {
            userId = user.id;
            console.log(`[SupportController] Extracted userId from token: ${userId}`);
          }
        } catch (tokenError) {
          console.log(`[SupportController] Token validation failed (expected for anonymous): ${tokenError}`);
        }
      } else {
        console.log(`[SupportController] No Authorization header found`);
      }
    } catch (e) {
      // Ignore auth errors for public endpoint - token might be missing or invalid
      // This is fine for a public endpoint
      console.log(`[SupportController] Error extracting userId: ${e}`);
    }

    return this.supportService.createTicket({
      subject: dto.subject || 'Contact Form Submission',
      message: dto.message,
      category: dto.category,
      priority: dto.priority,
      userId,
      name: dto.name,
      email: dto.email,
      ipAddress,
      userAgent,
    });
  }

  @Get('admin/tickets')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List support tickets (all admins can access)' })
  async listTickets(
    @Req() req: Request,
    @Query('status') status?: SupportStatus,
    @Query('scope') scope: 'all' | 'mine' | 'unassigned' = 'all',
    @Query('category') category?: string,
  ) {
    const admin = req.user as { id: string; adminCapabilities?: string[] };
    const isSuperAdmin = (admin.adminCapabilities || []).includes('SUPER_ADMIN');

    return this.supportService.listTickets(admin.id, {
      status,
      scope,
      isSuperAdmin,
      category: category as any,
    });
  }

  @Get('admin/tickets/:id')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get support ticket details (all admins can access)' })
  async getTicket(@Param('id') id: string) {
    return this.supportService.getTicket(id);
  }

  @Post('admin/tickets/:id/assign')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Assign ticket to yourself (all admins can access)' })
  async assignTicket(@Param('id') id: string, @Req() req: Request) {
    const admin = req.user as { id: string; adminCapabilities?: string[] };
    return this.supportService.assignTicket(
      id,
      admin.id,
      admin.adminCapabilities || [],
    );
  }

  @Post('admin/tickets/:id/resolve')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Resolve a support ticket (all admins can access)' })
  async resolveTicket(
    @Param('id') id: string,
    @Body() body: { resolution: string; notes?: string },
    @Req() req: Request,
  ) {
    if (!body.resolution) {
      throw new BadRequestException('Resolution text is required');
    }

    const admin = req.user as { id: string };
    return this.supportService.resolveTicket(id, admin.id, {
      resolution: body.resolution,
      notes: body.notes,
    });
  }

  @Post('admin/tickets/:id/status')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update ticket status (all admins can access)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: SupportStatus; notes?: string },
    @Req() req: Request,
  ) {
    const admin = req.user as { id: string };
    return this.supportService.updateTicketStatus(
      id,
      admin.id,
      body.status,
      body.notes,
    );
  }

  @Post('admin/tickets/:id/respond')
  @Public()
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Respond to a support ticket (sends email to user)' })
  async respondToTicket(
    @Param('id') id: string,
    @Body() body: { response: string },
    @Req() req: Request,
  ) {
    if (!body.response || !body.response.trim()) {
      throw new BadRequestException('Response text is required');
    }

    const admin = req.user as { id: string };
    return this.supportService.respondToTicket(id, admin.id, body.response);
  }
}

