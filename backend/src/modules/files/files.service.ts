import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { FileKind } from '@prisma/client';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly bucket = process.env.S3_BUCKET ?? 'flow';
  private readonly client = new Client({
    endPoint: new URL(process.env.S3_ENDPOINT ?? 'http://minio:9000').hostname,
    port: Number(new URL(process.env.S3_ENDPOINT ?? 'http://minio:9000').port || 9000),
    useSSL: false,
    accessKey: process.env.S3_ACCESS_KEY ?? 'flowadmin',
    secretKey: process.env.S3_SECRET_KEY ?? 'flowadmin123'
  });

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async uploadProjectFile(projectId: string, userId: string, file: Express.Multer.File) {
    const extension = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin';
    const storageKey = `projects/${projectId}/${randomUUID()}.${extension}`;

    await this.client.putObject(this.bucket, storageKey, file.buffer, file.size, {
      'Content-Type': file.mimetype
    });

    return this.prisma.fileAsset.create({
      data: {
        projectId,
        createdBy: userId,
        storageKey,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        kind: FileKind.FLOW_IMAGE
      }
    });
  }

  async get(id: string) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async getObject(id: string) {
    const file = await this.get(id);
    const stream = await this.client.getObject(this.bucket, file.storageKey);
    return { file, stream };
  }

  async getObjectBuffer(id: string) {
    const { file, stream } = await this.getObject(id);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return { file, buffer: Buffer.concat(chunks) };
  }

  async putImportedFile(projectId: string, userId: string, filename: string, mimeType: string, buffer: Buffer) {
    const storageKey = `projects/${projectId}/imported/${randomUUID()}-${filename}`;
    await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, { 'Content-Type': mimeType });
    return this.prisma.fileAsset.create({
      data: {
        projectId,
        createdBy: userId,
        storageKey,
        filename,
        mimeType,
        size: buffer.length,
        kind: FileKind.FLOW_IMAGE
      }
    });
  }

  async health() {
    await this.client.bucketExists(this.bucket);
    return true;
  }
}
