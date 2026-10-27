import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { call } from '@orpc/server';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../auth/auth.controller.js';
import { PrismaService } from '../database/prisma.service.js';
import { apiError, apiErrorInterceptor } from './api-error.js';

// The envelope is checked through a real controller, the way the module wires it:
// ORPCModule.forRoot({ interceptors: [apiErrorInterceptor] }).
async function createController(findUnique = vi.fn()) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: PrismaService, useValue: { user: { findUnique } } },
      { provide: ConfigService, useValue: { get: () => 'test' } },
    ],
  }).compile();
  return moduleRef.get(AuthController);
}

// Unexpected errors go to the server log for the operator; capture it to keep the output clean.
const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
beforeEach(() => logError.mockClear());

const res = { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
const interceptors = [apiErrorInterceptor];

describe('API error envelope', () => {
  it('tells the user to correct their input when validation fails', async () => {
    const controller = await createController();

    const error = await call(
      controller.login(res),
      { email: 'not-an-email', password: '' },
      { interceptors },
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
      data: { category: 'CORRECT_INPUT', code: 'VALIDATION_FAILED' },
    });
    // The envelope is only a category and a code: no zod issues, no echoed input.
    expect(JSON.stringify(error)).not.toContain('not-an-email');
  });

  it('hides database details behind a generic retry error', async () => {
    const databaseError = Object.assign(
      new Error('Invalid `prisma.user.findUnique()` invocation: relation "User" does not exist'),
      { code: 'P2021' },
    );
    const controller = await createController(vi.fn().mockRejectedValue(databaseError));

    const error = await call(
      controller.login(res),
      { email: 'admin@erp.local', password: 'password' },
      { interceptors },
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      data: { category: 'RETRY', code: 'INTERNAL_ERROR' },
    });
    const body = JSON.stringify(error);
    expect(body).not.toContain('prisma');
    expect(body).not.toContain('relation');
    expect(body).not.toContain('P2021');
    expect(body).not.toContain('at ');
    // The operator still gets the real cause in the server log.
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('relation "User"'));
  });

  it('tells the user to retry when the database reports a write conflict', async () => {
    const writeConflict = Object.assign(
      new Error('Invalid `prisma.stockBalance.update()` invocation: write conflict or deadlock'),
      { code: 'P2034' },
    );
    const controller = await createController(vi.fn().mockRejectedValue(writeConflict));

    const error = await call(
      controller.login(res),
      { email: 'admin@erp.local', password: 'password' },
      { interceptors },
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'CONFLICT',
      status: 409,
      data: { category: 'RETRY', code: 'CONFLICT' },
    });
    expect(JSON.stringify(error)).not.toMatch(/prisma|deadlock|P2034/);
  });

  it('keeps the machine code of a rejection a handler raises with apiError', async () => {
    const controller = await createController(
      vi.fn().mockRejectedValue(apiError('CORRECT_INPUT', 'SKU_TAKEN', 'SKU already exists')),
    );

    const error = await call(
      controller.login(res),
      { email: 'admin@erp.local', password: 'password' },
      { interceptors },
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
      message: 'SKU already exists',
      data: { category: 'CORRECT_INPUT', code: 'SKU_TAKEN' },
    });
  });

  it('leaves deliberate rejections such as a wrong password untouched', async () => {
    const controller = await createController(vi.fn().mockResolvedValue(null));

    await expect(
      call(
        controller.login(res),
        { email: 'nobody@erp.local', password: 'password' },
        { interceptors },
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });
});
