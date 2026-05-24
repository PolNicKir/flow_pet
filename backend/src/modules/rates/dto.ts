import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRateDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  category!: string;
}

export class UpdateRateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

