import { test, expect } from '@playwright/test';

test.describe('MUD Game', () => {
  test('page loads with title and input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('炎黄群侠传');

    const input = page.locator('input[placeholder="输入命令..."]');
    await expect(input).toBeVisible();
  });

  test('typing and clicking send echoes command', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });

    await input.fill('look');
    await sendBtn.click();

    // The output should contain the echoed command
    const output = page.locator('#root');
    await expect(output).toContainText('look');
  });

  test('pressing Enter sends command', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');

    await input.fill('help');
    await input.press('Enter');

    const output = page.locator('#root');
    await expect(output).toContainText('help');
  });

  test('health endpoint is reachable', async ({ request, baseURL }) => {
    // The Vite proxy forwards /health to Express
    const resp = await request.get(`${baseURL}/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toEqual({ status: 'ok' });
  });

  test('welcome banner is CSS-framed, not Unicode box-drawing', async ({ page }) => {
    await page.goto('/');

    // Banner text should be visible
    await expect(page.locator('text=炎 黄 群 侠 传')).toBeVisible();
    await expect(page.locator('text=输入 help 查看可用命令')).toBeVisible();

    // The page source must NOT contain Unicode box-drawing characters
    const html = await page.content();
    expect(html).not.toContain('╔');
    expect(html).not.toContain('╚');
    expect(html).not.toContain('║');
    expect(html).not.toContain('╝');
    expect(html).not.toContain('╗');
    expect(html).not.toContain('╠');
    expect(html).not.toContain('╣');

    // Banner disappears after a command
    const input = page.locator('input[placeholder="输入命令..."]');
    await input.fill('look');
    await input.press('Enter');

    await expect(page.locator('text=炎 黄 群 侠 传')).not.toBeVisible();
  });
});

