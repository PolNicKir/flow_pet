import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum ProjectKind {
  PROJECT = 'PROJECT',
  TEMPLATE = 'TEMPLATE'
}

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  client?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsEnum(ProjectKind)
  type?: ProjectKind;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  client?: string;

  @IsOptional()
  @IsString()
  brand?: string;
}

