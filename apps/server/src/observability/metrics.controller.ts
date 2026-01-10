import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsAccessGuard } from './metrics-access.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('observability')
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @UseGuards(MetricsAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Prometheus metrics (admin or allowlisted IPs)' })
  async getMetrics(): Promise<string> {
    return this.metrics.getRegistry().metrics();
  }
}
