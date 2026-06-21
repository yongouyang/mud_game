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

    const output = page.locator('#root');

    async function cmd(text: string) {
      await input.fill(text);
      await sendBtn.click();
      await page.waitForTimeout(200);
    }

    // Register and create a strong character
    await cmd('register battletest pw123');
    await cmd('战狂');
    await cmd('set str 20');
    await cmd('done');
    await expect(output).toContainText('角色创建成功');

    // Navigate: square → n → mainstreet → n → gate → n → forest1
    await cmd('n'); await cmd('n'); await cmd('n');
    await expect(output).toContainText('山林·入口');

    // Engage bandit
    await cmd('kill 山贼');

    // Wait for ~4 auto-tick rounds
    await page.waitForTimeout(6000);

    const text = (await output.textContent()) || '';

    // Player dealt damage to bandit
    expect(text).toMatch(/造成了.*点伤害/);

    // Bandit counter-attacked the player
    expect(text).toMatch(/山贼.*一式/);

    // Damage values are integers (no NaN, no decimals)
    const allDamages = text.match(/造成了 (\d+) 点伤害/g) || [];
    expect(allDamages.length).toBeGreaterThanOrEqual(2);

    // Wait for battle to resolve
    if (!text.includes('倒下了') && !text.includes('你被击败了')) {
      await page.waitForTimeout(8000);
    }

    const finalText = (await output.textContent()) || '';

    if (finalText.includes('山贼 倒下了') || finalText.includes('倒下了')) {
      expect(finalText).toMatch(/获得了.*经验/);
      expect(finalText).toMatch(/潜能/);
      expect(finalText).toMatch(/银子/);
    }
  });
});
test.describe('End-to-end battle', () => {
  test('battle start shows damage and no NaN', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');

    async function cmd(text: string) {
      await input.fill(text);
      await sendBtn.click();
      await page.waitForTimeout(200);
    }

    const uid = 'pw' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂');
    await cmd('set str 20');
    await cmd('done');
    await expect(output).toContainText('角色创建成功');

    await cmd('n'); await cmd('n'); await cmd('n');
    await expect(output).toContainText('山林·入口');

    await cmd('kill 山贼');

    const text = (await output.textContent()) || '';
    expect(text).toMatch(/造成了.*点伤害/);
    expect(text).not.toMatch(/NaN/);

    const damages = text.match(/造成了 (\d+) 点伤害/g) || [];
    expect(damages.length).toBeGreaterThanOrEqual(1);
    for (const d of damages) {
      const val = parseInt(d.match(/\d+/)![0], 10);
      expect(val).toBeGreaterThan(0);
      expect(val).toBeLessThan(200);
    }
  });
});
