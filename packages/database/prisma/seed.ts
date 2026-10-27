import { createPrismaClient, hashPassword, Role } from '../src/index.js';

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp',
);

// Stores per TOR Section 8. The store is also the stock location.
const stores = [
  { code: 'B01', name: 'Central' },
  { code: 'B02', name: 'Riverside' },
];

// Demo + acceptance accounts (also shown on the login page). Re-running the seed resets them.
// Store-bound roles (Purchasing officer, Store employee) carry a store; org-wide roles do not.
const users: Array<{ email: string; name: string; role: Role; storeCode: string | null }> = [
  { email: 'admin@erp.local', name: 'Admin User', role: Role.ADMINISTRATOR, storeCode: null },
  { email: 'manager01@erp.local', name: 'Manager One', role: Role.MANAGER, storeCode: null },
  {
    email: 'buyer01@erp.local',
    name: 'Buyer One',
    role: Role.PURCHASING_OFFICER,
    storeCode: 'B01',
  },
  {
    email: 'staff_b01@erp.local',
    name: 'Staff B01',
    role: Role.STORE_EMPLOYEE,
    storeCode: 'B01',
  },
  {
    email: 'staff_b02@erp.local',
    name: 'Staff B02',
    role: Role.STORE_EMPLOYEE,
    storeCode: 'B02',
  },
];
const DEMO_PASSWORD = 'password';

async function main() {
  const storeIdByCode = new Map<string, string>();
  for (const store of stores) {
    const row = await prisma.store.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: store,
    });
    storeIdByCode.set(store.code, row.id);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const user of users) {
    const storeId = user.storeCode ? (storeIdByCode.get(user.storeCode) ?? null) : null;
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, storeId },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        storeId,
      },
    });
  }
  console.log(
    `Seeded ${stores.length} stores and ${users.length} users (password: "${DEMO_PASSWORD}").`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
