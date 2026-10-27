import path from 'node:path';

// The demo accounts from packages/database/prisma/seed.ts. Tests never create users;
// they sign in as one of these through the saved storage state. Four TOR roles: org-wide
// Administrator and Manager (no store), and store-bound Purchasing officer and Store employee.
export const DEMO_PASSWORD = 'password';

export const accounts = {
  admin: { email: 'admin@erp.local', name: 'Admin User', role: 'ADMINISTRATOR' },
  manager: { email: 'manager01@erp.local', name: 'Manager One', role: 'MANAGER' },
  buyer: { email: 'buyer01@erp.local', name: 'Buyer One', role: 'PURCHASING_OFFICER' },
  staff: { email: 'staff_b01@erp.local', name: 'Staff B01', role: 'STORE_EMPLOYEE' },
} as const;

export type AccountName = keyof typeof accounts;

/** Where auth.setup.ts saves each account's cookies. Gitignored. */
export function storageState(name: AccountName) {
  return path.resolve(import.meta.dirname, '..', '.auth', `${name}.json`);
}
