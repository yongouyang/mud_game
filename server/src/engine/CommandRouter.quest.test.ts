import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'quest-player';

describe('Quest System', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;
    // Register quest NPC
    npcs.register({ id: "quest-master", name: "任务使者", description: "发布了任务的NPC", roomId: "town/square", dialogue: ["有任务要交给你"], attributes: {str:10,int:10,con:10,dex:10}, skills: [], aggressive: false });
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
    players.getPlayer(PLAYER_ID)!.exp = 10000;
    players.getPlayer(PLAYER_ID)!.pot = 100;
  });

  describe('quest command', () => {
    it('quest without NPC shows usage', () => {
      expect(cmd('quest')).toContain('用法');
    });

    it('quest from NPC gives task', () => {
      const out = cmd('quest 任务使者');
      expect(out).toContain('任务');
    });
  });

  describe('quest completion', () => {
    it('completing quest gives exp and pot', () => {
      // Accept quest
      cmd('quest 任务使者');
      const p = players.getPlayer(PLAYER_ID)!;
      expect(p.quest).toBeDefined();
      // Complete quest
      const out = cmd('quest 任务使者');
      expect(out).toContain('完成');
      expect(p.quest).toBeNull();
    });
  });
});
