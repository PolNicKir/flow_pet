import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectType } from '@prisma/client';
import { defaultCeDocument } from '../ce/default-ce';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, ProjectKind, UpdateProjectDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(type: ProjectType) {
    return this.prisma.project.findMany({
      where: { type, deletedAt: null },
      include: { owner: { select: { id: true, displayName: true } } },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async create(userId: string, dto: CreateProjectDto) {
    const projectType = dto.type === ProjectKind.TEMPLATE ? ProjectType.TEMPLATE : ProjectType.PROJECT;
    const ce = defaultCeDocument(dto.name);

    return this.prisma.project.create({
      data: {
        type: projectType,
        name: dto.name,
        client: dto.client ?? '',
        brand: dto.brand ?? dto.name,
        ownerId: userId,
        ceDocument: {
          create: ce as any
        }
      },
      include: { ceDocument: true }
    });
  }

  async get(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        ceDocument: true,
        owner: { select: { id: true, displayName: true } }
      }
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.get(id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        dataVersion: { increment: 1 }
      }
    });
  }

  async delete(id: string, userId: string) {
    const project = await this.get(id);
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Only owner can delete this item');
    }
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async createTemplateFromProject(projectId: string, userId: string) {
    const source = await this.get(projectId);
    const ce = source.ceDocument;

    return this.prisma.project.create({
      data: {
        type: ProjectType.TEMPLATE,
        name: `${source.name} template`,
        client: source.client,
        brand: source.brand,
        currency: source.currency,
        logoFileId: source.logoFileId,
        ownerId: userId,
        ceDocument: ce
          ? {
              create: {
                requisites: ce.requisites as any,
                blocks: ce.blocks as any,
                ratesSnapshot: ce.ratesSnapshot as any,
                adjustments: ce.adjustments as any,
                totals: ce.totals as any
              }
            }
          : undefined
      },
      include: { ceDocument: true }
    });
  }

  async createProjectFromTemplate(templateId: string, userId: string) {
    const source = await this.get(templateId);
    if (source.type !== ProjectType.TEMPLATE) {
      throw new NotFoundException('Template not found');
    }

    const ce = source.ceDocument;
    return this.prisma.project.create({
      data: {
        type: ProjectType.PROJECT,
        name: `${source.name} project`,
        client: source.client,
        brand: source.brand,
        currency: source.currency,
        logoFileId: source.logoFileId,
        ownerId: userId,
        ceDocument: ce
          ? {
              create: {
                requisites: ce.requisites as any,
                blocks: ce.blocks as any,
                ratesSnapshot: ce.ratesSnapshot as any,
                adjustments: ce.adjustments as any,
                totals: ce.totals as any
              }
            }
          : undefined
      },
      include: { ceDocument: true }
    });
  }
}

