import { Injectable } from '@nestjs/common';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService
  ) {}

  async check() {
    const checks = {
      api: 'ok',
      database: 'ok',
      minio: 'ok'
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'error';
    }

    try {
      await this.files.health();
    } catch {
      checks.minio = 'error';
    }

    return {
      status: Object.values(checks).every((value) => value === 'ok') ? 'ok' : 'degraded',
      checks
    };
  }
}
