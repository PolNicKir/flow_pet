import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth.guard';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});

