import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DevController } from './dev.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DevController],
})
export class DevModule {}
