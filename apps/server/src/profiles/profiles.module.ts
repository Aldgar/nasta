import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfilesService } from './profiles.service';
import {
  ProfilesController,
  AdminProfilesController,
} from './profiles.controller';
import { ProfileFileUploadService } from './profile-file-upload.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfilesController, AdminProfilesController],
  providers: [ProfilesService, ProfileFileUploadService],
})
export class ProfilesModule {}
