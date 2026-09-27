import { Controller, Post, Body, UseGuards, Request, Get, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { RequestThrottleGuard } from '../common/guards/request-throttle.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(RequestThrottleGuard)
  @RateLimit(5, 60 * 60 * 1000)
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(registerDto);
    this.setAccessCookie(response, result.accessToken);
    return { user: result.user };
  }

  @Public()
  @UseGuards(RequestThrottleGuard)
  @RateLimit(10, 15 * 60 * 1000)
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    this.setAccessCookie(response, result.accessToken);
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.clearCookie('rfm_access_token', {
      ...this.cookieOptions(),
      httpOnly: true,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  private setAccessCookie(response: Response, token: string) {
    response.setHeader('Cache-Control', 'no-store');
    response.cookie('rfm_access_token', token, {
      ...this.cookieOptions(),
      httpOnly: true,
    });
  }

  private cookieOptions() {
    return {
      path: '/',
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
    };
  }
}
