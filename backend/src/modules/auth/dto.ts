import { IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  login!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;
}

export class LoginDto {
  @IsString()
  login!: string;

  @IsString()
  password!: string;
}

