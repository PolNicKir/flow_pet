import { Module } from '@nestjs/common';
import { ProjectsController, TemplatesController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController, TemplatesController],
  providers: [ProjectsService],
  exports: [ProjectsService]
})
export class ProjectsModule {}

