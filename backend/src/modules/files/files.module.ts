import { Module } from '@nestjs/common';
import { FilesController, ProjectFilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController, ProjectFilesController],
  providers: [FilesService],
  exports: [FilesService]
})
export class FilesModule {}

