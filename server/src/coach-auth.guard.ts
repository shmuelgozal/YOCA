import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppService, AuthenticatedUser } from './app.service';

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: AuthenticatedUser;
}

export function readSessionCookie(request: Request): string | undefined {
  const cookies = request.headers.cookie?.split(';') ?? [];
  const sessionCookie = cookies.find((cookie) =>
    cookie.trim().startsWith('yoca_session='),
  );
  return sessionCookie?.trim().slice('yoca_session='.length);
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly appService: AppService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionCookie(request);
    const user = token ? await this.appService.getSessionUser(token) : null;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    request.authenticatedUser = user;
    return true;
  }
}

@Injectable()
export class CoachAuthGuard extends SessionAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authenticatedUser;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (user.role !== 'coach') {
      throw new ForbiddenException('Coach access required');
    }
    return true;
  }
}

@Injectable()
export class MemberAuthGuard extends SessionAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authenticatedUser;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (user.role !== 'member') {
      throw new ForbiddenException('Member access required');
    }
    return true;
  }
}
