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

test.describe('End-to-end battle', () => {
  test('battle start shows damage and no NaN', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) { await input.fill(text); await sendBtn.click(); await page.waitForTimeout(200); }
    const uid = 'pw' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂'); await cmd('set str 20'); await cmd('done');
    await cmd('n'); await cmd('n'); await cmd('n');
    await cmd('kill 山贼');
    const text = (await output.textContent()) || '';
    expect(text).toMatch(/造成了.*点伤害/);
    expect(text).not.toMatch(/NaN/);
  });
});

test.describe('School-locked skills', () => {
  test('must join school and be at master to learn school skills', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) { await input.fill(text); await sendBtn.click(); await page.waitForTimeout(200); }
    const uid = 'pw' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂'); await cmd('set str 20'); await cmd('done');
    await expect(output).toContainText('角色创建成功');

    // Basic skill works anywhere
    await cmd('learn 基本拳脚');
    await expect(output).toContainText('你学会了基本拳脚');

    // School skill rejected without membership
    await cmd('learn 太极拳');
    await expect(output).toContainText('先加入该门派');

    // Navigate to Shaolin: n n n e s w
    await cmd('n'); await cmd('n'); await cmd('n'); await cmd('e');
    await cmd('s'); await cmd('w');
    await expect(output).toContainText('大雄宝殿');

    // Join
    await cmd('join 少林派');
    await expect(output).toContainText('拜入了少林派');

    // Learn school skill at master
    await cmd('learn 太极拳');
    await expect(output).toContainText('你学会了太极拳');
  });
});
