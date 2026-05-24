import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LocksService } from './locks.service';

@Controller('projects/:projectId/lock')
@UseGuards(AuthGuard)
export class LocksController {
  constructor(private readonly locksService: LocksService) {}

  @Get()
  get(@Param('projectId') projectId: string) {
    return this.locksService.get(projectId);
  }

  @Post()
  acquire(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.locksService.acquire(projectId, user);
  }

  @Post('heartbeat')
  heartbeat(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.locksService.heartbeat(projectId, user);
  }

  @Delete()
  release(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    return this.locksService.release(projectId, user);
  }
}

