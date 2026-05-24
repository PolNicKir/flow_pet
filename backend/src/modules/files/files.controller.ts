import { Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FilesService } from './files.service';

@UseGuards(AuthGuard)
export class FilesControllerBase {}

@Controller('projects/:projectId/files')
@UseGuards(AuthGuard)
export class ProjectFilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_, file, callback) => {
        callback(null, file.mimetype.startsWith('image/'));
      }
    })
  )
  upload(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.filesService.uploadProjectFile(projectId, user.id, file);
  }
}

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  async get(@Param('id') id: string, @Res() response: Response) {
    const { file, stream } = await this.filesService.getObject(id);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(response);
  }
}

