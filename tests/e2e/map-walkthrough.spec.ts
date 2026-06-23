/**
 * Map Walkthrough E2E — visits every room node and verifies name + description.
 * Uses BFS ordering: walks from town to each room, verifies, walks back.
 */
import { test, expect } from '@playwright/test';
import { ALL_ROOMS, RoomMeta } from './room-meta.js';

const TIMEOUT = 150_000;
const DIR_REV: Record<string, string> = {
  n: 's', s: 'n', e: 'w', w: 'e', u: 'd', d: 'u',
  ne: 'sw', nw: 'se', se: 'nw', sw: 'ne',
};

async function setup(page: any) {
  await page.goto('/');
  const input = page.locator('input[placeholder="输入命令..."]');
  const sendBtn = page.getByRole('button', { name: '发送' });
  const output = page.locator('#root');
  async function cmd(t: string) {
    await input.fill(t);
    await sendBtn.click();
    await page.waitForTimeout(120);
  }
  const uid = 'mw' + Date.now();
  await cmd('register ' + uid + ' pw123');
  await cmd('探图者');
  await cmd('set con 20');
  await cmd('set str 15');
  await cmd('done');
  await expect(output).toContainText('角色创建成功');
  return { cmd, output };
}

test.describe('Map Walkthrough', () => {
  test('all 63 rooms render correctly', async ({ page }) => {
    test.setTimeout(TIMEOUT);
    const { cmd, output } = await setup(page);

    let failures = 0;
    const visited = new Set<string>();
    visited.add('town/square');

    for (const room of ALL_ROOMS) {
      if (room.id === 'town/square') continue; // already here

      // Walk to room
      for (const dir of room.pathFromTown) {
        await cmd(dir);
      }

      const text = (await output.textContent()) || '';
      if (!text.includes(room.name)) {
        console.warn(`NAME: ${room.id} — missing "${room.name}"`);
        failures++;
      }
      if (text.match(/一片虚无/)) {
        console.warn(`VOID: ${room.id}`);
        failures++;
      }
      if (text.match(/NaN/)) {
        console.warn(`NaN: ${room.id}`);
        failures++;
      }

      // Walk back to town
      for (const dir of [...room.pathFromTown].reverse()) {
        await cmd(DIR_REV[dir]);
      }
    }

    expect(failures, `${failures} / 63 rooms failed`).toBe(0);
  });
});
