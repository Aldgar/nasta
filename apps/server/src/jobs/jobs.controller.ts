import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
  Request,
  Req,
  Query,
  ForbiddenException,
  Patch,
  Delete,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JobsService } from './jobs.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedForJobsGuard } from './guards/verified-for-jobs.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { DeleteJobDto } from './dto/delete-job.dto';
import { ChatFileUploadService } from '../chat/chat-file-upload.service';
import { AuthService } from '../auth/auth.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly fileUploadService: ChatFileUploadService,
    private readonly authService: AuthService,
  ) {}

  @Get('categories')
  @Public()
  async getCategories() {
    return this.jobsService.getAllCategories();
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  async createCategory(@Body() body: { name: string }) {
    return this.jobsService.createCategory(body.name);
  }

  @Get('my-jobs')
  @UseGuards(JwtAuthGuard)
  async getMyJobs(
    @Request() req: { user: { id: string; role?: string } },
    @Query('candidateId') candidateId?: string,
  ) {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only employers can access their jobs');
    }
    return this.jobsService.getMyJobs(req.user.id, candidateId);
  }

  @Get('employer/stats')
  @UseGuards(JwtAuthGuard)
  async getEmployerStats(
    @Request() req: { user: { id: string; role?: string } },
  ) {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only employers can access their stats');
    }
    return this.jobsService.getEmployerJobStats(req.user.id);
  }

  @Get()
  @Public()
  async list(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('skill') skill?: string,
  ) {
    const params = {
      lat: lat !== undefined ? Number(lat) : undefined,
      lng: lng !== undefined ? Number(lng) : undefined,
      radiusKm: radiusKm !== undefined ? Number(radiusKm) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
      category: category,
      skill: skill,
    };
    return this.jobsService.listJobs(params);
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string, @Req() req: ExpressRequest) {
    // Manually extract and validate token if present (optional auth for public endpoint)
    let userId: string | undefined;
    let userRole: string | undefined;

    try {
      const authHeader = req.headers.authorization;
      if (
        authHeader &&
        typeof authHeader === 'string' &&
        authHeader.startsWith('Bearer ')
      ) {
        const token = authHeader.substring(7);
        try {
          const user = await this.authService.validateToken(token);
          if (user?.id) {
            userId = user.id;
            userRole = user.role as string;
          }
        } catch (tokenError) {
          // Token validation failed - that's okay for public endpoint
          // User can still view ACTIVE jobs
        }
      }
    } catch (e) {
      // Ignore auth errors for public endpoint
    }

    return this.jobsService.getJob(id, userId, userRole);
  }

  @Post(':id/apply/cv')
  @UseGuards(JwtAuthGuard, VerifiedForJobsGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadCV(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const fileUrl = await this.fileUploadService.saveFile(file, 'document');
    return { fileUrl };
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard, VerifiedForJobsGuard)
  async apply(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body('coverLetter') coverLetter?: string,
    @Body('cvUrl') cvUrl?: string,
  ) {
    return this.jobsService.applyToJob(id, req.user.id, coverLetter, cvUrl);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Request()
    req: {
      user: {
        id: string;
        role: 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
      };
    },
    @Body() dto: CreateJobDto,
  ) {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only employers or admins can post jobs');
    }
    return this.jobsService.createJob(req.user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: Partial<CreateJobDto>,
  ) {
    return this.jobsService.updateJob(id, req.user.id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body('status')
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED',
  ) {
    return this.jobsService.updateJobStatus(id, req.user.id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: DeleteJobDto,
  ) {
    return this.jobsService.deleteJob(id, req.user.id, dto.reason);
  }
}
