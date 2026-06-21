import { test, expect } from '@playwright/test';

test.describe('Conditions & cure', () => {
  test('antidote can clear wolf poison', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) {
      await input.fill(text);
      await sendBtn.click();
      await page.waitForTimeout(200);
    }

    const uid = 'cond' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂');
    await cmd('set str 20');
    await cmd('done');
    await expect(output).toContainText('角色创建成功');

    // Gather enough silver to buy an antidote.
    for (let i = 0; i < 10; i++) await cmd('get 银子');
    await cmd('n');
    await cmd('buy 解毒丸');
    const inv = (await output.textContent()) || '';
    expect(inv).toContain('解毒丸');

    // Travel to the deep forest where wolves roam.
    await cmd('s');
    await cmd('n');
    await cmd('n');
    await cmd('n');
    await cmd('e');

    let poisoned = false;
    for (let i = 0; i < 30 && !poisoned; i++) {
      const text = (await output.textContent()) || '';
      if (text.includes('野狼')) {
        await cmd('kill 野狼');
      }
      await cmd('hit');
      await cmd('score');
      const score = (await output.textContent()) || '';
      if (score.includes('中毒')) {
        poisoned = true;
      }
      await page.waitForTimeout(500);
    }

    await cmd('use 解毒丸');
    const out = (await output.textContent()) || '';
    if (poisoned) {
      expect(out).toContain('解除了');
      await cmd('score');
      const finalScore = (await output.textContent()) || '';
      expect(finalScore).not.toContain('中毒');
    } else {
      // Even if RNG avoided poison, the antidote should report no poison.
      expect(out).toContain('你并没有');
    }
  });
});
