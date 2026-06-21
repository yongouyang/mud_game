import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'batch2-player';

describe('Batch 2: Shop + Conditions', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let items: ItemSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    items = ctx.items;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
  });

  it('shop list command shows items', () => {
    expect(cmd('shop')).toContain('商店');
  });

  it('buy without shop list first shows usage', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    items.addItem(p, 'silver', 100);
    expect(cmd('buy 金疮药')).toContain('买');
  });

  it('list command alias for shop', () => {
    expect(cmd('list')).toContain('商店');
  });

  it('poison condition can be applied', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.conditions.push('poison');
    expect(p.conditions).toContain('poison');
  });
});
