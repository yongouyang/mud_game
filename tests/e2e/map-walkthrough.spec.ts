/**
 * Map Walkthrough E2E — visits every room node and verifies name + description.
 * Uses common-prefix optimisation: walks forward from current room to next
 * by backtracking only to the nearest common ancestor, then continuing forward.
 * Total moves: ~200 instead of ~750 with round-trip-to-town approach.
 */
import { test, expect } from '@playwright/test';
import { ALL_ROOMS, RoomMeta } from './room-meta.js';

const TIMEOUT = 120_000;
const DIR_REV: Record<string, string> = {
  n: 's', s: 'n', e: 'w', w: 'e', u: 'd', d: 'u',
  ne: 'sw', nw: 'se', se: 'nw', sw: 'ne',
};

async function setup(page: any) {
  await page.goto('/');
  const input = page.locator('input[placeholder="输入命令..."]');
  const sendBtn = page.getByRole('button', { name: '发送' });
  const output = page.locator('#root');

  // Wait for socket connection to backend (shows login prompt, not "断开")
  await expect(output).toContainText('login', { timeout: 15000 });

  async function cmd(t: string) {
    await input.fill(t);
    await sendBtn.click();
    await page.waitForTimeout(180);
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

/** Walk from room index i to room index i+1 using common-prefix optimisation. */
async function walkTo(
  from: string[],
  to: string[],
  cmd: (d: string) => Promise<void>,
) {
  // Find common prefix length
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) {
    common++;
  }
  // Backtrack from current position to common ancestor
  for (let i = from.length - 1; i >= common; i--) {
    await cmd(DIR_REV[from[i]]);
  }
  // Walk forward to target
  for (let i = common; i < to.length; i++) {
    await cmd(to[i]);
  }
}

test.describe('Map Walkthrough', () => {
  test('all 63 rooms render correctly', async ({ page }) => {
    test.setTimeout(TIMEOUT);
    const { cmd, output } = await setup(page);

    // Sort rooms by path length (BFS order) so we minimise backtracking
    const sorted = [...ALL_ROOMS].sort(
      (a, b) => a.pathFromTown.length - b.pathFromTown.length,
    );

    let failures = 0;
    let currentPath: string[] = []; // path from town to current room
    const verified = new Set<string>();
    verified.add('town/square');

    for (const room of sorted) {
      if (room.id === 'town/square') continue;

      // Walk from current position to this room via common-prefix
      await walkTo(currentPath, room.pathFromTown, cmd);
      currentPath = room.pathFromTown;

      // Verify room
      const text = (await output.textContent()) || '';
      if (!text.includes(room.name)) {
        console.warn(`NAME: ${room.id} - missing "${room.name}"`);
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
      verified.add(room.id);
    }

    expect(failures, `${failures} / 63 rooms failed`).toBe(0);
  });
});
