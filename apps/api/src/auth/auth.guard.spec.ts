import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { User } from '@erp/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../database/prisma.service.js';
import { type AuthenticatedRequest, Public, Roles, StoreScoped } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { createSessionToken, SESSION_COOKIE } from './session-token.js';

const secret = 'test-secret-that-is-at-least-32-characters';
const staff: User = {
  id: 'u1',
  email: 'staff@erp.local',
  name: 'Staff User',
  role: 'STORE_EMPLOYEE',
  storeId: null,
};

/** The store id a store-scoped route reads from the request (here: the query string). */
const targetStore = (req: AuthenticatedRequest) =>
  (req.query as Record<string, string> | undefined)?.storeId;

class RoutesUnderTest {
  @Public()
  open() {}

  closed() {}

  @Roles('ADMINISTRATOR')
  adminOnly() {}

  @StoreScoped(targetStore)
  storeScoped() {}
}

function setup(user: User | null) {
  const findUnique = vi.fn().mockResolvedValue(user);
  const guard = new AuthGuard(
    new Reflector(),
    { user: { findUnique } } as unknown as PrismaService,
    { get: () => secret } as unknown as ConfigService<Env, true>,
  );

  function run(route: keyof RoutesUnderTest, cookie?: string, query?: Record<string, string>) {
    const request = { headers: { cookie }, query } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => RoutesUnderTest.prototype[route],
      getClass: () => RoutesUnderTest,
    } as unknown as ExecutionContext;
    return { request, result: guard.canActivate(context) };
  }

  return { run, findUnique };
}

const sessionCookie = (userId: string) => `${SESSION_COOKIE}=${createSessionToken(userId, secret)}`;

describe('AuthGuard', () => {
  it('lets anyone call a @Public() route', async () => {
    const { run } = setup(null);

    await expect(run('open').result).resolves.toBe(true);
  });

  it('rejects a protected route without a session', async () => {
    const { run } = setup(staff);

    await expect(run('closed').result).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a tampered cookie', async () => {
    const { run, findUnique } = setup(staff);

    await expect(
      run('closed', `${SESSION_COOKIE}=u1.9999999999999.forged`).result,
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a session whose user no longer exists', async () => {
    const { run } = setup(null);

    await expect(run('closed', sessionCookie('gone')).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the signed-in user to the request', async () => {
    const { run } = setup(staff);
    const { request, result } = run('closed', sessionCookie('u1'));

    await expect(result).resolves.toBe(true);
    expect(request.user).toEqual(staff);
  });

  it('rejects a user without the required role', async () => {
    const { run } = setup(staff);

    await expect(run('adminOnly', sessionCookie('u1')).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a user with the required role', async () => {
    const { run } = setup({ ...staff, role: 'ADMINISTRATOR' });

    await expect(run('adminOnly', sessionCookie('u1')).result).resolves.toBe(true);
  });

  describe('store-scoped routes', () => {
    const b01Staff: User = { ...staff, storeId: 'B01' };
    const b02Staff: User = { ...staff, storeId: 'B02' };
    const manager: User = { ...staff, role: 'MANAGER', storeId: null };

    it('allows a store-bound user to act on their own store', async () => {
      const { run } = setup(b01Staff);

      await expect(
        run('storeScoped', sessionCookie('u1'), { storeId: 'B01' }).result,
      ).resolves.toBe(true);
    });

    it('rejects a store-bound user acting on another store (AC-04)', async () => {
      const { run } = setup(b02Staff);

      await expect(
        run('storeScoped', sessionCookie('u1'), { storeId: 'B01' }).result,
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an org-wide user (no store) act on any store', async () => {
      const { run } = setup(manager);

      await expect(
        run('storeScoped', sessionCookie('u1'), { storeId: 'B01' }).result,
      ).resolves.toBe(true);
    });

    it('denies a store-bound user with no store rather than treating them as org-wide', async () => {
      const storelessStaff: User = { ...staff, role: 'STORE_EMPLOYEE', storeId: null };
      const { run } = setup(storelessStaff);

      await expect(
        run('storeScoped', sessionCookie('u1'), { storeId: 'B01' }).result,
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a store-scoped request with no session before reading the target store', async () => {
      const { run } = setup(b01Staff);

      await expect(run('storeScoped', undefined, { storeId: 'B01' }).result).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
