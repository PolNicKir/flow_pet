import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HistoryService } from '../history/history.service';
import { CeCalculationService } from './ce-calculation.service';
import { UpdateCeDto } from './dto';

@Injectable()
export class CeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculation: CeCalculationService,
    private readonly history: HistoryService
  ) {}

  async get(projectId: string) {
    const ce = await this.prisma.ceDocument.findUnique({ where: { projectId } });
    if (!ce) {
      throw new NotFoundException('CE document not found');
    }
    return ce;
  }

  async update(projectId: string, userId: string, dto: UpdateCeDto) {
    const calculated = this.calculation.calculate(dto as any);
    const updated = await this.prisma.ceDocument.update({
      where: { projectId },
      data: calculated as any
    });
    if (dto.autosave) {
      await this.history.createAutosaveVersion(projectId, userId, 'AUTOSAVE_CE');
    } else {
      await this.history.createVersion(projectId, userId, 'SAVE_CE', dto.comment ?? '');
    }
    return updated;
  }

  async recalculate(projectId: string) {
    const ce = await this.get(projectId);
    const calculated = this.calculation.calculate({
      requisites: ce.requisites as Record<string, unknown>,
      blocks: ce.blocks as any[],
      ratesSnapshot: ce.ratesSnapshot as unknown[],
      adjustments: ce.adjustments as Record<string, unknown>
    });
    return this.prisma.ceDocument.update({
      where: { projectId },
      data: calculated as any
    });
  }
}
