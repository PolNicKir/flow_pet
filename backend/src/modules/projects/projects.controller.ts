import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectType } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.guard';
import { CreateProjectDto, ProjectKind, UpdateProjectDto } from './dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.list(ProjectType.PROJECT);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, { ...dto, type: ProjectKind.PROJECT });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.projectsService.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.delete(id, user.id);
  }

  @Post(':id/create-template')
  createTemplate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.createTemplateFromProject(id, user.id);
  }
}

@Controller('templates')
@UseGuards(AuthGuard)
export class TemplatesController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.list(ProjectType.TEMPLATE);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, { ...dto, type: ProjectKind.TEMPLATE });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.projectsService.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.delete(id, user.id);
  }

  @Post(':id/create-project')
  createProject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.createProjectFromTemplate(id, user.id);
  }
}
