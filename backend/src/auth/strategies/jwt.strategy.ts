import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        request => {
          const cookieHeader = request?.headers?.cookie;
          if (typeof cookieHeader !== 'string') return null;
          const tokenCookie = cookieHeader.split(';').map(value => value.trim())
            .find(value => value.startsWith('rfm_access_token='));
          if (!tokenCookie) return null;
          const token = tokenCookie.slice('rfm_access_token='.length);
          try {
            return decodeURIComponent(token);
          } catch {
            return token;
          }
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
