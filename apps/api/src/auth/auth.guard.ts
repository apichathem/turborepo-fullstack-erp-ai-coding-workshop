import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Role } from '@erp/contracts';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  type AuthenticatedRequest,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  STORE_SCOPED_KEY,
  type StoreExtractor,
} from './auth.decorators.js';
import { readCookie, SESSION_COOKIE, verifySessionToken } from './session-token.js';

export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  storeId: true,
} as const;

/**
 * Registered globally in AuthModule. Loads the user from the session cookie into `request.user`,
 * then rejects the request unless the route is `@Public()` (401) or the role doesn't match `@Roles()` (403).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const targets = [context.getHandler(), context.getClass()];

    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const userId =
      token && verifySessionToken(token, this.config.get('AUTH_SECRET', { infer: true }));
    if (userId) {
      request.user =
        (await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT })) ??
        undefined;
    }

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (!request.user) throw new UnauthorizedException();

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(request.user.role)) throw new ForbiddenException();

    const extractStore = this.reflector.getAllAndOverride<StoreExtractor | undefined>(
      STORE_SCOPED_KEY,
      targets,
    );
    if (extractStore && request.user.storeId !== null) {
      // Store-bound users may only act on their own store; org-wide users (storeId null) pass.
      if (extractStore(request) !== request.user.storeId) throw new ForbiddenException();
    }

    return true;
  }
}
