import { test, expect } from '@playwright/test';

test.describe('Leveling & attributes', () => {
  test('player levels up and can spend attribute points', async ({ page }) => {
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

    const uid = 'lv' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂');
    await cmd('set str 20');
    await cmd('done');
    await expect(output).toContainText('角色创建成功');

    // Complete the town delivery quest for deterministic EXP (no shared mob competition).
    await cmd('quest 说书人 letter-delivery');
    await cmd('e');
    await cmd('quest 王掌柜');
    await expect(output).toContainText('任务完成');

    // Level-up should have happened from quest EXP.
    await cmd('score');
    const scoreText = (await output.textContent()) || '';
    expect(scoreText).toMatch(/属性点:\s*[1-9]/);

    // Spend attribute point.
    await cmd('tianfu con 1');
    await cmd('score');
    const finalText = (await output.textContent()) || '';
    expect(finalText).toContain('根骨(con):');
  });
});
