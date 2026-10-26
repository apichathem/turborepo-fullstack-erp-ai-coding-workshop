import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role, User } from '@erp/contracts';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
export const STORE_SCOPED_KEY = 'auth:storeScoped';

/** The request after `AuthGuard` has run. `user` is unset on public routes without a session. */
export type AuthenticatedRequest = Request & { user?: User };

/**
 * Reads the target store id a store-scoped request acts on (e.g. from params or body).
 * Return `undefined` when the request carries no store, which store-bound users are denied.
 */
export type StoreExtractor = (request: AuthenticatedRequest) => string | undefined;

/** Every route requires a signed-in user unless it (or its controller) is marked `@Public()`. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Only users with one of these roles may call the route, e.g. `@Roles('ADMINISTRATOR')`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Confine a route to the caller's store. `AuthGuard` compares the store id returned by
 * `extract(request)` against the signed-in user's `storeId`: store-bound users (Purchasing
 * officer, Store employee) may only act on their own store; org-wide users (Administrator,
 * Manager, `storeId === null`) pass. Enforced at the API for every request, independent of the UI.
 */
export const StoreScoped = (extract: StoreExtractor) => SetMetadata(STORE_SCOPED_KEY, extract);

/** The signed-in user, set by `AuthGuard`. Use as a parameter decorator next to `@Implement(...)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
