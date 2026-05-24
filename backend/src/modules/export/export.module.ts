import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [FilesModule],
  controllers: [ExportController],
  providers: [ExportService]
})
export class ExportModule {}

