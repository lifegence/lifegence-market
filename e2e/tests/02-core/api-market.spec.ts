import { test, expect, FrappeClient } from '@lifegence/e2e-common';

test.describe('Market Data — API (P1)', () => {
  let client: FrappeClient;

  test.beforeAll(async ({ baseURL }) => {
    client = await FrappeClient.login(
      baseURL!,
      process.env.ADMIN_USR || 'Administrator',
      process.env.ADMIN_PWD || 'admin',
    );
  });
  test.afterAll(async () => await client.dispose());

  for (const entity of ['Stock Master', 'Stock Price']) {
    test(`${entity} list is accessible`, async () => {
      const list = await client.getList<{ name: string }>(entity, {
        fields: ['name'], limit_page_length: 5,
      });
      expect(Array.isArray(list)).toBe(true);
    });
  }

  test('Market Settings single loads', async () => {
    const doc = await client.call<{ name: string }>('frappe.client.get', {
      doctype: 'Market Settings', name: 'Market Settings',
    });
    expect(doc.name).toBe('Market Settings');
  });
});
