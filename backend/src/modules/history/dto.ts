import { IsString, MinLength } from 'class-validator';

export class VersionCommentDto {
  @IsString()
  @MinLength(1)
  comment!: string;
}

