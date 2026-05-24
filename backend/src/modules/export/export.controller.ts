import { Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ExportService } from './export.service';

@Controller()
@UseGuards(AuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('projects/:projectId/export/pdf')
  async pdf(@Param('projectId') projectId: string, @Query('flowPage') flowPage: any, @Res() response: Response) {
    this.send(response, await this.exportService.projectPdf(projectId, flowPage ?? 'A3'));
  }

  @Get('projects/:projectId/export/xlsx')
  async xlsx(@Param('projectId') projectId: string, @Res() response: Response) {
    this.send(response, await this.exportService.projectXlsx(projectId));
  }

  @Get('projects/:projectId/export/archive')
  async archive(@Param('projectId') projectId: string, @Res() response: Response) {
    this.send(response, await this.exportService.projectArchive(projectId));
  }

  @Post('projects/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  import(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.exportService.importArchive(user.id, file);
  }

  @Get('flows/:flowId/export/image')
  async flowImage(@Param('flowId') flowId: string, @Res() response: Response) {
    this.send(response, await this.exportService.flowImage(flowId));
  }

  private send(response: Response, file: { filename: string; contentType: string; buffer: Buffer }) {
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    response.send(file.buffer);
  }
}

