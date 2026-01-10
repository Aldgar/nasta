import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('admin-jobs')
@Controller('admin/jobs')
@Public()
@UseGuards(AdminJwtGuard)
export class AdminJobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list all jobs with optional status filter' })
  async list(
    @Query('status')
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const where = status ? ({ status } as const) : ({} as const);
    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        select: {
          id: true,
          title: true,
          status: true,
          city: true,
          country: true,
          createdAt: true,
          employer: { select: { id: true, email: true } },
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);
    return { items, total, page: p, limit: l };
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: get job details' })
  async get(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        requirements: true,
        responsibilities: true,
        status: true,
        city: true,
        country: true,
        createdAt: true,
        employer: { select: { id: true, email: true } },
        category: { select: { id: true, name: true } },
      },
    });
    return job;
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: update job status' })
  async setStatus(
    @Param('id') id: string,
    @Body('status')
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED',
  ) {
    const allowed = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'];
    if (!allowed.includes(String(status))) {
      throw new BadRequestException('Invalid status');
    }
    const updated = await this.prisma.job.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
    return { job: updated, message: 'Status updated' };
  }
}
