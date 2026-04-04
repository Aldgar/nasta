import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController, AdminUsersController } from './users.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule } from '@nestjs/config';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [PrismaModule, NotificationsModule, ConfigModule, VehiclesModule],
  controllers: [
    UsersController,
    AdminUsersController,
    AdminDashboardController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
