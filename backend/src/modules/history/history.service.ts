import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string) {
    return this.prisma.version.findMany({
      where: { projectId },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async snapshotProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        ceDocument: true,
        flows: {
          include: { nodes: true, edges: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async createVersion(projectId: string, userId: string, actionType: string, comment: string) {
    const snapshot = await this.snapshotProject(projectId);
    return this.prisma.version.create({
      data: {
        projectId,
        userId,
        actionType,
        comment,
        snapshot: snapshot as any
      }
    });
  }

  async createAutosaveVersion(projectId: string, userId: string, actionType: string) {
    await this.prisma.version.deleteMany({
      where: {
        projectId,
        userId,
        actionType,
        createdAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      }
    });

    const existing = await this.prisma.version.findFirst({
      where: { projectId, userId, actionType },
      orderBy: { createdAt: 'desc' }
    });
    const snapshot = await this.snapshotProject(projectId);
    const data = {
      projectId,
      userId,
      actionType,
      comment: 'Автосохранено',
      snapshot: snapshot as any
    };
    return existing
      ? this.prisma.version.update({ where: { id: existing.id }, data })
      : this.prisma.version.create({ data });
  }

  async restore(projectId: string, versionId: string, userId: string, comment: string) {
    const version = await this.prisma.version.findFirst({ where: { id: versionId, projectId } });
    if (!version) {
      throw new NotFoundException('Version not found');
    }

    await this.createVersion(projectId, userId, 'BEFORE_RESTORE', `Перед откатом: ${comment}`);
    const snapshot = version.snapshot as any;

    await this.prisma.$transaction(async (tx) => {
      await tx.flow.deleteMany({ where: { projectId } });

      await tx.project.update({
        where: { id: projectId },
        data: {
          name: snapshot.name,
          client: snapshot.client,
          brand: snapshot.brand,
          currency: snapshot.currency,
          logoFileId: snapshot.logoFileId,
          dataVersion: { increment: 1 }
        }
      });

      if (snapshot.ceDocument) {
        await tx.ceDocument.upsert({
          where: { projectId },
          update: {
            requisites: snapshot.ceDocument.requisites,
            blocks: snapshot.ceDocument.blocks,
            ratesSnapshot: snapshot.ceDocument.ratesSnapshot,
            adjustments: snapshot.ceDocument.adjustments,
            totals: snapshot.ceDocument.totals
          },
          create: {
            projectId,
            requisites: snapshot.ceDocument.requisites,
            blocks: snapshot.ceDocument.blocks,
            ratesSnapshot: snapshot.ceDocument.ratesSnapshot,
            adjustments: snapshot.ceDocument.adjustments,
            totals: snapshot.ceDocument.totals
          }
        });
      }

      for (const flow of snapshot.flows ?? []) {
        await tx.flow.create({
          data: {
            id: flow.id,
            projectId,
            name: flow.name,
            order: flow.order,
            viewport: flow.viewport,
            nodes: {
              create: (flow.nodes ?? []).map((node: any) => ({
                id: node.id,
                slideNumber: node.slideNumber,
                title: node.title,
                designType: node.designType,
                codingType: node.codingType,
                popupsCount: node.popupsCount,
                comments: node.comments,
                positionX: node.positionX,
                positionY: node.positionY,
                mainImageFileId: node.mainImageFileId,
                additionalImageFileIds: node.additionalImageFileIds ?? [],
                compact: node.compact,
                meta: node.meta ?? {}
              }))
            },
            edges: {
              create: (flow.edges ?? []).map((edge: any) => ({
                id: edge.id,
                sourceNodeId: edge.sourceNodeId,
                targetNodeId: edge.targetNodeId,
                label: edge.label,
                color: edge.color,
                lineType: edge.lineType,
                meta: edge.meta ?? {}
              }))
            }
          }
        });
      }
    });

    return this.createVersion(projectId, userId, 'RESTORE_VERSION', comment);
  }
}
