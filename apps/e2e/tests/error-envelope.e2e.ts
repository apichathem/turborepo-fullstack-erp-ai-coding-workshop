import { expect, test } from '@playwright/test';

// Demo (#4): a validation rejection renders a "correct your input" Thai message, and no stack
// trace or database detail leaks to the client.
// The "retry" half of the Demo line has no browser path yet: no route can answer with a conflict
// until a later ticket adds one. It is covered at the web component seam in routes/login.test.tsx.
test('a validation rejection renders a correct-your-input Thai message and leaks nothing', async ({
  page,
}) => {
  await page.goto('/login');

  // The browser accepts "admin@localhost" as an email, the API's schema does not.
  await page.getByLabel('Email').fill('admin@localhost');
  await page.getByLabel('Password').fill('password');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/login')),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);

  await expect(page.getByRole('alert')).toHaveText(
    'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและแก้ไขข้อมูลที่กรอก แล้วลองอีกครั้ง',
  );
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.data).toEqual({ category: 'CORRECT_INPUT', code: 'VALIDATION_FAILED' });
  expect(JSON.stringify(body)).not.toMatch(/stack|prisma|admin@localhost|\bat \S+\.(js|ts)/i);
});
