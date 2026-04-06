import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleFileUploadService } from './vehicle-file-upload.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleFileUploadService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
