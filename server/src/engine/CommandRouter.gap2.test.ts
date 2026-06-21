import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { TestSystemClock } from '../time/SystemClock.js';
import { Scheduler } from '../time/Scheduler.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'gap2-player';

describe('Remaining Gaps', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;
  let items: ItemSystem;
  let clock: TestSystemClock;
  let scheduler: Scheduler;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;
    items = ctx.items;
    clock = ctx.clock;
    scheduler = ctx.scheduler;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
  });

  describe('NPC respawn', () => {
    beforeEach(() => {
      npcs.register({ id: "respawn-test", name: "复活测试怪", description: "a test creature", roomId: "town/training", dialogue: [], attributes: {str:5,int:5,con:5,dex:5}, skills: [], aggressive: false });
    });

    it('NPC respawns after being killed', () => {
      const npc = npcs.getNpc('respawn-test');
      expect(npc).toBeTruthy();
      npc!.hp = 0;
      npc!.state = 'idle';
      expect(npc!.hp).toBe(0);
      npcs.respawn('respawn-test');
      const revived = npcs.getNpc('respawn-test');
      expect(revived?.hp).toBeGreaterThan(0);
      expect(revived?.state).toBe('idle');
    });
  });

  describe('shop system', () => {
    it('buy command exists and rejects with no target', () => {
      expect(cmd('buy')).toContain('用法');
    });

    it('buy requires silver', () => {
      const result = cmd('buy 金疮药');
      expect(result).toContain('不足');
    });

    it('can buy when having enough silver', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'silver', 100);
      p.pot = 0;
      const result = cmd('buy 金疮药');
      expect(result).toContain('买');
    });
  });
});
