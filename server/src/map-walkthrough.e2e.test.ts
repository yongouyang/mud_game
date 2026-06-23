/**
 * Server E2E: Verify every room via direct CommandRouter.handle('look') calls.
 * Teleports player to each room to avoid combat/movement hazards.
 */
import { describe, it, expect } from 'vitest';
import { createTestContext } from './test-utils.js';
import { ALL_ROOMS } from '../../tests/e2e/room-meta.js';

describe('E2E Map Walkthrough (server)', () => {
  it('all 63 rooms render correctly', () => {
    const ctx = createTestContext();
    const pid = 'walker';

    // Create player
    ctx.players.createPlayer(pid);
    ctx.router.handle('探图者', pid);
    ctx.router.handle('set con 20', pid);
    ctx.router.handle('set str 15', pid);
    const doneOut = ctx.router.handle('done', pid);
    expect(doneOut).toContain('角色创建成功');

    const player = ctx.players.getPlayer(pid)!;
    let failures = 0;

    for (const room of ALL_ROOMS) {
      // Teleport player to this room
      player.currentRoom = room.id;
      player.state = 'playing';

      // Call 'look' to render the room
      const out = ctx.router.handle('look', pid);
      if (!out.includes(room.name)) {
        console.warn(`NAME: ${room.id} - missing "${room.name}"`);
        failures++;
      }
      if (out.includes('一片虚无')) {
        console.warn(`VOID: ${room.id}`);
        failures++;
      }
      if (out.includes('NaN')) {
        console.warn(`NaN: ${room.id}`);
        failures++;
      }
    }

    expect(failures, `${failures} / 63 rooms failed`).toBe(0);
  });
});
