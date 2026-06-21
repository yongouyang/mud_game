import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'boss-player';

describe('CommandRouter: boss PvE', () => {
  let router: CommandRouter;
  let players: PlayerManager;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香');
    cmd('done');
    const p = players.getPlayer(PLAYER_ID)!;
    p.attributes = { ...p.attributes, str: 100, dex: 100, con: 50 };
    p.currentRoom = 'wilderness/cave';
  });

  it('killing the boss drops guaranteed loot', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    cmd('kill 黑风寨主');
    let out = '';
    for (let i = 0; i < 80 && p.state === 'fighting'; i++) {
      out = cmd('hit');
    }
    expect(out).toContain('战利品');
    expect(out).toContain('黑风刀');
    expect(out).toContain('寨主令');
    expect(p.inventory.some((i) => i.itemId === 'black-wind-blade')).toBe(true);
  });
});
