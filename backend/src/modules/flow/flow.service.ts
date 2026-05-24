import { Injectable, NotFoundException } from '@nestjs/common';
import { CeCalculationService } from '../ce/ce-calculation.service';
import { HistoryService } from '../history/history.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlowDto, SaveFlowDto } from './dto';
import { ceFlowDiff, flowQuantities, updateCeBlocksFromFlow } from './flow-ce-sync';
import { calculateFlowStatistics } from './flow-statistics';

@Injectable()
export class FlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculation: CeCalculationService,
    private readonly history: HistoryService
  ) {}

  list(projectId: string) {
    return this.prisma.flow.findMany({
      where: { projectId },
      include: { nodes: true, edges: true },
      orderBy: { order: 'asc' }
    });
  }

  async create(projectId: string, dto: CreateFlowDto) {
    const count = await this.prisma.flow.count({ where: { projectId } });
    return this.prisma.flow.create({
      data: {
        projectId,
        name: dto.name,
        order: count
      },
      include: { nodes: true, edges: true }
    });
  }

  async get(flowId: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { nodes: true, edges: true }
    });
    if (!flow) {
      throw new NotFoundException('Flow not found');
    }
    return flow;
  }

  async save(flowId: string, userId: string, dto: SaveFlowDto) {
    const existingFlow = await this.get(flowId);

    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.flowNode.deleteMany({ where: { flowId } });
      await tx.flowEdge.deleteMany({ where: { flowId } });

      await tx.flow.update({
        where: { id: flowId },
        data: {
          name: dto.name,
          viewport: (dto.viewport ?? {}) as any
        }
      });

      if (dto.nodes.length > 0) {
        await tx.flowNode.createMany({
          data: dto.nodes.map((node) => ({
            id: String(node.id),
            flowId,
            slideNumber: String(node.slideNumber ?? ''),
            title: String(node.title ?? ''),
            designType: String(node.designType ?? ''),
            codingType: String(node.codingType ?? ''),
            popupsCount: Number(node.popupsCount ?? 0),
            comments: String(node.comments ?? ''),
            positionX: Number(node.positionX ?? 0),
            positionY: Number(node.positionY ?? 0),
            mainImageFileId: node.mainImageFileId ? String(node.mainImageFileId) : null,
            additionalImageFileIds: node.additionalImageFileIds ?? [],
            compact: Boolean(node.compact ?? true),
            meta: node.meta ?? {}
          }))
        });
      }

      if (dto.edges.length > 0) {
        await tx.flowEdge.createMany({
          data: dto.edges.map((edge) => ({
            id: String(edge.id),
            flowId,
            sourceNodeId: String(edge.sourceNodeId ?? edge.source),
            targetNodeId: String(edge.targetNodeId ?? edge.target),
            label: String(edge.label ?? ''),
            color: String(edge.color ?? '#64748b'),
            lineType: String(edge.lineType ?? 'smoothstep'),
            meta: edge.meta ?? {}
          }))
        });
      }

      return tx.flow.findUnique({
        where: { id: flowId },
        include: { nodes: true, edges: true }
      });
    });
    if (dto.autosave) {
      await this.history.createAutosaveVersion(existingFlow.projectId, userId, 'AUTOSAVE_FLOW');
    } else {
      await this.history.createVersion(existingFlow.projectId, userId, 'SAVE_FLOW', dto.comment ?? '');
    }
    return saved;
  }

  async delete(flowId: string) {
    await this.get(flowId);
    return this.prisma.flow.delete({ where: { id: flowId } });
  }

  async statistics(flowId: string) {
    const flow = await this.get(flowId);
    return calculateFlowStatistics(flow.nodes);
  }

  async ceDiff(flowId: string) {
    const flow = await this.get(flowId);
    const ce = await this.prisma.ceDocument.findUnique({ where: { projectId: flow.projectId } });
    if (!ce) {
      throw new NotFoundException('CE document not found');
    }
    return ceFlowDiff(ce.blocks as any[], flowQuantities(flow.nodes));
  }

  async syncToCe(flowId: string, userId: string, comment: string) {
    const flow = await this.get(flowId);
    const ce = await this.prisma.ceDocument.findUnique({ where: { projectId: flow.projectId } });
    if (!ce) {
      throw new NotFoundException('CE document not found');
    }

    const blocks = updateCeBlocksFromFlow(ce.blocks as any[], flowQuantities(flow.nodes));
    const calculated = this.calculation.calculate({
      requisites: ce.requisites as Record<string, unknown>,
      blocks,
      ratesSnapshot: ce.ratesSnapshot as unknown[],
      adjustments: ce.adjustments as Record<string, unknown>
    });

    const updated = await this.prisma.ceDocument.update({
      where: { projectId: flow.projectId },
      data: calculated as any
    });
    await this.history.createVersion(flow.projectId, userId, 'SYNC_FLOW_TO_CE', comment);
    return updated;
  }
}
