import { test, expect } from '@playwright/test';

test.describe('Schools & skill trees', () => {
  test('joining Shaolin grants bonus and unlocks signature skill', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');
    async function cmd(text: string) {
      await input.fill(text);
      await sendBtn.click();
      await page.waitForTimeout(150);
    }

    const uid = 'sch' + Date.now();
    await cmd('register ' + uid + ' pw123');
    await cmd('战狂');
    await cmd('set str 15');
    await cmd('set con 15');
    await cmd('done');
    await expect(output).toContainText('角色创建成功');

    // Travel to Shaolin hall: n n n e s w
    await cmd('n'); await cmd('n'); await cmd('n'); await cmd('e'); await cmd('s'); await cmd('w');

    await cmd('join 少林派');
    await expect(output).toContainText('拜入了少林派');
    await expect(output).toContainText('根骨 +3');

    await cmd('score');
    const score = (await output.textContent()) || '';
    expect(score).toContain('少林派');
    expect(score).toContain('根骨(con): 18');

    // Learn basic cuff to Lv.5 so Luohan-quan can be learned.
    for (let i = 0; i < 5; i++) await cmd('learn 基本拳脚');
    await cmd('learn 罗汉拳');
    await cmd('skills');
    const skills = (await output.textContent()) || '';
    expect(skills).toContain('罗汉拳');
  });
});
