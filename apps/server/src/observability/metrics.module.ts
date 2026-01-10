import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { CspReportController } from './csp-report.controller';
import { MetricsAccessGuard } from './metrics-access.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';

@Module({
  providers: [MetricsService, MetricsAccessGuard, AdminJwtGuard],
  controllers: [MetricsController, CspReportController],
  exports: [MetricsService],
})
export class MetricsModule {}
