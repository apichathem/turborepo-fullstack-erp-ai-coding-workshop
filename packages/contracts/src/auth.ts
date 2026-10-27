import { oc } from '@orpc/contract';
import * as z from 'zod';

export const RoleSchema = z.enum([
  'ADMINISTRATOR',
  'PURCHASING_OFFICER',
  'STORE_EMPLOYEE',
  'MANAGER',
]);
export type Role = z.infer<typeof RoleSchema>;

/**
 * Roles bound to a single store: they may only act on their own `storeId`. Org-wide roles
 * (Administrator, Manager) are not store-scoped. This is the source of truth for the store-scope
 * check so authorization never relies on `storeId` being null to decide "org-wide".
 */
export const STORE_BOUND_ROLES = ['PURCHASING_OFFICER', 'STORE_EMPLOYEE'] as const satisfies Role[];

/** Whether a role is confined to one store (Purchasing officer, Store employee). */
export const isStoreBoundRole = (role: Role): boolean =>
  (STORE_BOUND_ROLES as readonly Role[]).includes(role);

/** The signed-in user as the API exposes it (never includes the password hash). */
export const UserSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    role: RoleSchema,
    /** The store a store-bound user belongs to. `null` for org-wide roles (Administrator, Manager). */
    storeId: z.string().nullable(),
  })
  .refine((user) => isStoreBoundRole(user.role) === (user.storeId !== null), {
    error: 'Store-bound roles must have a storeId; org-wide roles must not.',
    path: ['storeId'],
  });
export type User = z.infer<typeof UserSchema>;

export const LoginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const SessionSchema = z.object({
  user: UserSchema.nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const authContract = {
  login: oc
    .route({
      method: 'POST',
      path: '/auth/login',
      summary: 'Sign in with email and password',
      tags: ['Auth'],
    })
    .input(LoginInputSchema)
    .output(UserSchema),
  logout: oc.route({ method: 'POST', path: '/auth/logout', summary: 'Sign out', tags: ['Auth'] }),
  me: oc
    .route({
      method: 'GET',
      path: '/auth/me',
      summary: 'The signed-in user, or null',
      tags: ['Auth'],
    })
    .output(SessionSchema),
};
