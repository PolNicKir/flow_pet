import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VersionCommentDto } from './dto';
import { HistoryService } from './history.service';

@Controller('projects/:projectId/versions')
@UseGuards(AuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.historyService.list(projectId);
  }

  @Post(':versionId/restore')
  restore(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: VersionCommentDto
  ) {
    return this.historyService.restore(projectId, versionId, user.id, dto.comment);
  }
}

