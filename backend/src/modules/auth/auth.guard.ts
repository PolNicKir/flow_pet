import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export type AuthUser = {
  id: string;
  login: string;
  displayName: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { cookies?: Record<string, string>; user?: AuthUser }>();
    const token = request.cookies?.flow_session;

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthUser>(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid session');
    }
  }
}
