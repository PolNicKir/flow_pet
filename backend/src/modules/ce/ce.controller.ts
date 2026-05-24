import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CeService } from './ce.service';
import { UpdateCeDto } from './dto';

@Controller('projects/:projectId/ce')
@UseGuards(AuthGuard)
export class CeController {
  constructor(private readonly ceService: CeService) {}

  @Get()
  get(@Param('projectId') projectId: string) {
    return this.ceService.get(projectId);
  }

  @Patch()
  update(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateCeDto) {
    return this.ceService.update(projectId, user.id, dto);
  }

  @Post('recalculate')
  recalculate(@Param('projectId') projectId: string) {
    return this.ceService.recalculate(projectId);
  }
}
