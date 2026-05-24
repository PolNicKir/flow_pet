import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [HealthController],
  providers: [HealthService]
})
export class HealthModule {}
