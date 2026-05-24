import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateCeDto {
  @IsObject()
  requisites!: Record<string, unknown>;

  @IsArray()
  blocks!: any[];

  @IsOptional()
  @IsArray()
  ratesSnapshot?: unknown[];

  @IsOptional()
  @IsObject()
  adjustments?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  autosave?: boolean;

  @ValidateIf((dto) => !dto.autosave)
  @IsString()
  @MinLength(1)
  comment?: string;
}
