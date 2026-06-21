import { test, expect } from '@playwright/test';

test.describe('MUD Game', () => {
  test('page loads with title and input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('炎黄群侠传');

    const input = page.locator('input[placeholder="输入命令..."]');
    await expect(input).toBeVisible();
  });

  test('sends command and gets server response', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });

    // Server responds with login prompt on empty input
    await input.fill('');
    await sendBtn.click();

    const output = page.locator('#root');
    await expect(output).toContainText('login');
    await expect(output).toContainText('register');
  });

  test('pressing Enter sends command', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');

    await input.fill('help');
    await input.press('Enter');

    const output = page.locator('#root');
    // help should show available commands
    await expect(output).toContainText('help');
  });

  test('health endpoint returns ok with online count', async ({ request, baseURL }) => {
    const resp = await request.get(`${baseURL}/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe('ok');
    expect(typeof body.online).toBe('number');
  });
});
