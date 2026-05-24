import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  maxAge: 7 * 24 * 60 * 60 * 1000
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.register(dto);
    response.cookie('flow_session', session.token, cookieOptions);
    return { user: session.user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto);
    response.cookie('flow_session', session.token, cookieOptions);
    return { user: session.user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('flow_session');
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: unknown) {
    return { user };
  }
}

