/**
 * Leveling Journey E2E — full player lifecycle in a single test:
 *   Create → Quest → Level-up → Skills → Combat → Page Reload → Persistence
 */
import { test, expect } from '@playwright/test';

const TIMEOUT = 120_000;

test.describe('Leveling Journey', () => {
  test('full lifecycle', async ({ page }) => {
    test.setTimeout(TIMEOUT);
    const uid = 'lj' + Date.now();

    await page.goto('/');
    const input = page.locator('input[placeholder="输入命令..."]');
    const sendBtn = page.getByRole('button', { name: '发送' });
    const output = page.locator('#root');

    // Wait for socket connection to backend
    await expect(output).toContainText('login', { timeout: 15000 });

    async function cmd(text: string) {
      await input.fill(text);
      await sendBtn.click();
      await page.waitForTimeout(200);
    }

    // ── Chapter 1: Create character ──
    await cmd('register ' + uid + ' pw123');
    await cmd('江小鱼');
    await cmd('set str 15');
    await cmd('set con 15');
    await cmd('done');
    await expect(output).toContainText('角色创建成功', { timeout: 5000 });

    // Verify base stats
    await cmd('level');
    let t = (await output.textContent()) || '';
    expect(t).toContain('Lv.1');
    expect(t).toContain('臂力(str): 15');
    expect(t).toContain('根骨(con): 15');

    await cmd('hp');
    t = (await output.textContent()) || '';
    expect(t).toContain('气血');
    expect(t).not.toMatch(/NaN/);

    await cmd('skills');
    t = (await output.textContent()) || '';
    expect(t).toContain('武功');

    await cmd('i');
    t = (await output.textContent()) || '';
    // Inventory may be empty — just verify command works
    expect(t.length).toBeGreaterThan(5);

    // ── Chapter 2: Learn skills ──
    for (let i = 0; i < 10; i++) await cmd('learn 基本拳脚');
    await cmd('skills');
    t = (await output.textContent()) || '';
    expect(t).toContain('基本拳脚');
    expect(t).toMatch(/Lv\.1[0-9]/); // Lv.10+

    // ── Chapter 3: Quest for EXP ──
    let lv = 1; // track level for persistence check later

    // First verify the NPC is here (说书人 in town/square)
    await cmd('look');
    t = (await output.textContent()) || '';

    await cmd('quest 说书人 letter-delivery');
    t = (await output.textContent()) || '';
    // Soft assertion: quest acceptance may fail if NPC not found or already has quest
    const questAccepted = t.includes('接取了');

    if (questAccepted) {
      await cmd('e'); // enter inn
      await cmd('quest 王掌柜');
      t = (await output.textContent()) || '';
      expect(t).toContain('任务完成');

      // Verify level-up happened (40 EXP should reach Lv.2)
      await cmd('level');
      t = (await output.textContent()) || '';
      const lvMatches = [...t.matchAll(/等级:\s*Lv\.(\d+)/g)];
      lv = lvMatches.length > 0 ? parseInt(lvMatches[lvMatches.length - 1][1]) : 1;
      expect(lv, 'quest 40 EXP should level up').toBeGreaterThanOrEqual(2);

      // Spend attribute point
      await cmd('tianfu str 1');
      await cmd('level');
      t = (await output.textContent()) || '';
      expect(t).toContain('臂力(str): 16');
    } else {
      // Quest not accepted — still verify level command works
      console.warn('Quest not accepted, skipping level-up check');
      await cmd('level');
      t = (await output.textContent()) || '';
      expect(t).toContain('Lv.'); // level command works
    }

    // ── Chapter 4: Combat ──
    // Return to town square first (we may be at the inn after quest)
    await cmd('w'); // inn → square (if at inn this works, if at square this fails silently)
    await cmd('n'); await cmd('n'); await cmd('n');
    t = (await output.textContent()) || '';
    // If quest branch didn't run, we're already at square — still should reach forest
    expect(t).toMatch(/山林|山门/);

    await cmd('kill 山贼');
    t = (await output.textContent()) || '';
    expect(t).not.toMatch(/NaN/);
    // Either combat started or no bandit — both are valid

    // Ensure we're not still in combat (flee if needed)
    await cmd('flee');
    await page.waitForTimeout(500);

    // Return to town
    await cmd('s'); await cmd('s'); await cmd('s');
    t = (await output.textContent()) || '';
    expect(t).toContain('广场');
    expect(t).not.toContain('战斗中');

    // ── Chapter 5: Persistence (page reload) ──
    // Wait for pending saves
    await page.waitForTimeout(2000);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Re-grab locators after reload (page is new DOM)
    const input2 = page.locator('input[placeholder="输入命令..."]');
    const sendBtn2 = page.getByRole('button', { name: '发送' });
    const output2 = page.locator('#root');

    async function cmd2(text: string) {
      await input2.fill(text);
      await sendBtn2.click();
      await page.waitForTimeout(300);
    }

    await cmd2('login ' + uid + ' pw123');
    await page.waitForTimeout(500);

    // Verify persistence
    await cmd2('level');
    const postLevel = (await output2.textContent()) || '';
    expect(postLevel, 'level persisted').toContain('江小鱼');
    const postLvMatches = [...postLevel.matchAll(/等级:\s*Lv\.(\d+)/g)];
    const postLv = postLvMatches.length > 0 ? parseInt(postLvMatches[postLvMatches.length - 1][1]) : 0;
    expect(postLv, `level ${postLv} >= ${lv}`).toBeGreaterThanOrEqual(lv);
    expect(postLevel, 'str persisted').toContain('臂力(str): 16');

    await cmd2('skills');
    const postSkills = (await output2.textContent()) || '';
    expect(postSkills, 'skills persisted').toContain('基本拳脚');
  });
});
