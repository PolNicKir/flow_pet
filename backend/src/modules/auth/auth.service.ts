import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { login: dto.login } });
    if (existing) {
      throw new ConflictException('Login already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        displayName: dto.displayName,
        passwordHash: await argon2.hash(dto.password)
      }
    });

    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { login: dto.login } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid login or password');
    }

    return this.issueSession(user);
  }

  private async issueSession(user: { id: string; login: string; displayName: string }) {
    const publicUser = {
      id: user.id,
      login: user.login,
      displayName: user.displayName
    };
    const token = await this.jwtService.signAsync(publicUser);
    return { token, user: publicUser };
  }
}

