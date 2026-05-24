import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VersionCommentDto } from '../history/dto';
import { CreateFlowDto, SaveFlowDto } from './dto';
import { FlowService } from './flow.service';

@Controller()
@UseGuards(AuthGuard)
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Get('projects/:projectId/flows')
  list(@Param('projectId') projectId: string) {
    return this.flowService.list(projectId);
  }

  @Post('projects/:projectId/flows')
  create(@Param('projectId') projectId: string, @Body() dto: CreateFlowDto) {
    return this.flowService.create(projectId, dto);
  }

  @Get('flows/:flowId')
  get(@Param('flowId') flowId: string) {
    return this.flowService.get(flowId);
  }

  @Put('flows/:flowId')
  save(@Param('flowId') flowId: string, @CurrentUser() user: AuthUser, @Body() dto: SaveFlowDto) {
    return this.flowService.save(flowId, user.id, dto);
  }

  @Delete('flows/:flowId')
  delete(@Param('flowId') flowId: string) {
    return this.flowService.delete(flowId);
  }

  @Get('flows/:flowId/statistics')
  statistics(@Param('flowId') flowId: string) {
    return this.flowService.statistics(flowId);
  }

  @Get('flows/:flowId/ce-diff')
  ceDiff(@Param('flowId') flowId: string) {
    return this.flowService.ceDiff(flowId);
  }

  @Post('flows/:flowId/sync-to-ce')
  syncToCe(@Param('flowId') flowId: string, @CurrentUser() user: AuthUser, @Body() dto: VersionCommentDto) {
    return this.flowService.syncToCe(flowId, user.id, dto.comment);
  }
}
