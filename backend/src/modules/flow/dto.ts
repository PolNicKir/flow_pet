import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateFlowDto {
  @IsString()
  name!: string;
}

export class SaveFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  viewport?: Record<string, unknown>;

  @IsArray()
  nodes!: Array<Record<string, any>>;

  @IsArray()
  edges!: Array<Record<string, any>>;

  @IsOptional()
  @IsBoolean()
  autosave?: boolean;

  @ValidateIf((dto) => !dto.autosave)
  @IsString()
  @MinLength(1)
  comment?: string;
}

export class ReorderFlowDto {
  @IsNumber()
  order!: number;
}
