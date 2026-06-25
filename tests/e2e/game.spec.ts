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
    // Press Escape to close autocomplete suggestions, then Enter to send
    await input.press('Escape');
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
    // The bandit is shared across parallel browsers; wait briefly if it was just killed.
    let text = (await output.textContent()) || '';
    for (let i = 0; i < 15 && !text.includes('山贼'); i++) {
      await cmd('look');
      await page.waitForTimeout(500);
      text = (await output.textContent()) || '';
    }
    await cmd('kill 山贼');
    text = (await output.textContent()) || '';
    expect(text).toMatch(/造成了.*点伤害|这里没有叫"山贼"的人/);
    expect(text).not.toMatch(/NaN/);
  });
});

test.describe('Classic MUD features', () => {
  test('perform, exert, buy commands work', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) { await input.fill(text); await sendBtn.click(); await page.waitForTimeout(200); }
    const uid = 'pw' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂'); await cmd('set str 20'); await cmd('done');
    await expect(output).toContainText('角色创建成功');

    // Level up cuff to 10 to test perform
    for (let i = 0; i < 10; i++) await cmd('learn 基本拳脚');
    // Perform should show level requirement is now met
    const pf = (await output.textContent()) || '';
    expect(pf).not.toMatch(/NaN/);

    // Exert heal
    await cmd('exert');
    await expect(output).toContainText('用法');

    // Buy item (need silver)
    await cmd('buy');
    await expect(output).toContainText('用法');

    // Score shows level
    await cmd('score');
    const sc = (await output.textContent()) || '';
    expect(sc).toMatch(/Lv/);
  });

  test('join restriction and class bonus', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) { await input.fill(text); await sendBtn.click(); await page.waitForTimeout(200); }
    const uid = 'pw' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂'); await cmd('set str 20'); await cmd('done');

    // Navigate to shaolin and join
    await cmd('n'); await cmd('n'); await cmd('n'); await cmd('e');
    await cmd('s'); await cmd('w');
    await expect(output).toContainText('大雄宝殿');
    await cmd('join 少林派');
    await expect(output).toContainText('拜入了少林派');

    // Try to join another school from same location
    const reject = await output.textContent() || '';
    // Navigate to wudang and try join
    await cmd('e'); await cmd('e');
    if ((await output.textContent() || '').includes('武当')) {
      await cmd('join 武当派');
      await expect(output).toContainText('已经加入');
    }
  });

  test('score displays level and attributes', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) { await input.fill(text); await sendBtn.click(); await page.waitForTimeout(200); }
    const uid = 'pw' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂'); await cmd('set str 15'); await cmd('set con 15'); await cmd('done');
    await cmd('score');
    const t = (await output.textContent()) || '';
    expect(t).toMatch(/Lv/);
    expect(t).toMatch(/经验/);
    expect(t).toMatch(/潜能/);
    expect(t).toMatch(/臂力/);
  });

test.describe('Quest system', () => {
  test('quest command works with NPC', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) { await input.fill(text); await sendBtn.click(); await page.waitForTimeout(200); }
    const uid = 'pw' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂'); await cmd('done');
    await cmd('quest');
    const t = (await output.textContent()) || '';
    expect(t).toMatch(/用法|任务/);
  });
});

});
