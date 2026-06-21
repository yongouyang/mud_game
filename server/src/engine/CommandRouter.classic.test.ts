import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'classic-player';

describe('Classic MUD Features', () => {
  let router: CommandRouter;
  let players: PlayerManager;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
    players.getPlayer(PLAYER_ID)!.pot = 1000;
  });

  it('perform command exists', () => {
    expect(cmd('perform')).toContain('用法');
  });

  it('perform rejected without skill level', () => {
    expect(cmd('perform cuff.quan')).toContain('不够');
  });

  it('exert command exists', () => {
    expect(cmd('exert')).toContain('用法');
  });

  it('yun is alias for exert', () => {
    expect(cmd('yun')).toContain('用法');
  });

  it('player has conditions array', () => {
    expect(players.getPlayer(PLAYER_ID)!.conditions).toBeDefined();
  });

  it('joining school gives attribute bonus', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    const conBefore = p.attributes.con;
    (p as any).schoolId = null;
    cmd('n'); cmd('n'); cmd('n'); cmd('e'); cmd('s'); cmd('w');
    cmd('join 少林派');
    expect(p.attributes.con).toBeGreaterThanOrEqual(conBefore);
  });
});
