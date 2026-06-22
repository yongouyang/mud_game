import { test, expect } from '@playwright/test';

test.describe('HP vs level attribute labels', () => {
  test('hp shows effective attributes and level shows base attributes', async ({ page }) => {
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

    const uid = 'attr' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂');
    await cmd('set str 20');
    await cmd('done');
    await expect(output).toContainText('角色创建成功');

    // Train basic cuff to Lv.10 so skill bonus adds +1 str.
    for (let i = 0; i < 10; i++) {
      await cmd('learn 基本拳脚');
    }

    await cmd('hp');
    const hpText = (await output.textContent()) || '';
    expect(hpText).toContain('属性（含武功/装备加成）：');
    expect(hpText).toMatch(/臂力\(str\):\s*21/);
    expect(hpText).not.toContain('基础属性（不含武功/装备加成）');

    await cmd('clear');
    await cmd('level');
    const levelText = (await output.textContent()) || '';
    expect(levelText).toContain('基础属性（不含武功/装备加成）：');
    expect(levelText).toMatch(/臂力\(str\):\s*20/);
    expect(levelText).not.toContain('属性（含武功/装备加成）');
  });
});
